import { $ } from 'zx';

import { SUBTITLE_TEXT_CODECS } from '../media/constants.js';
import type {
    AudioStreamInfo,
    SubtitleKind,
    SubtitleStreamInfo,
    VideoProbe,
    VideoStreamInfo,
    VideoTiming,
} from '../media/types.js';

type FfprobeStream = {
    index: number;
    codec_type: string;
    codec_name?: string;
    width?: number;
    height?: number;
    avg_frame_rate?: string;
    r_frame_rate?: string;
    tags?: Record<string, string>;
    disposition?: Record<string, number>;
    channels?: number;
    time_base?: string;
};

type FfprobeFormat = {
    format_name?: string;
    tags?: Record<string, string>;
    duration?: string;
    start_time?: string;
};

type FfprobeResponse = {
    streams: FfprobeStream[];
    format?: FfprobeFormat;
};

function parseFrameRate(rate?: string): number | null {
    if (!rate || rate === '0/0') {
        return null;
    }
    if (rate.includes('/')) {
        const [num, den] = rate.split('/').map(Number);
        if (den && den !== 0) {
            return num / den;
        }
    }
    const value = Number(rate);
    return Number.isFinite(value) ? value : null;
}

const IGNORED_FORMAT_TAG_KEYS = new Set(['major_brand', 'minor_version', 'compatible_brands', 'encoder']);
const IGNORED_STREAM_TAG_KEYS = new Set(['language', 'handler_name', 'vendor_id', 'encoder']);

function hasRelevantTags(tags: Record<string, string> | undefined, ignoredKeys: Set<string> = new Set()): boolean {
    if (!tags) {
        return false;
    }
    return Object.entries(tags).some(([key, value]) => !ignoredKeys.has(key) && String(value ?? '').trim().length > 0);
}

function hasMetadata(format?: FfprobeFormat, streams: FfprobeStream[] = []): boolean {
    if (hasRelevantTags(format?.tags, IGNORED_FORMAT_TAG_KEYS)) {
        return true;
    }
    return streams.some(stream => hasRelevantTags(stream.tags, IGNORED_STREAM_TAG_KEYS));
}

function toSubtitleKind(stream: FfprobeStream): SubtitleKind {
    if (stream.codec_type === 'attachment') {
        return 'attachment';
    }
    if (stream.codec_type === 'data') {
        return 'data';
    }
    const codec = (stream.codec_name ?? '').toLowerCase();
    return SUBTITLE_TEXT_CODECS.has(codec) ? 'text' : 'binary';
}

function mapVideoStream(stream?: FfprobeStream): VideoStreamInfo | null {
    if (!stream) {
        return null;
    }
    const frameRate = parseFrameRate(stream.avg_frame_rate) ?? parseFrameRate(stream.r_frame_rate) ?? 0;

    return {
        index: stream.index,
        width: stream.width ?? 0,
        height: stream.height ?? 0,
        codecName: stream.codec_name ?? '',
        frameRate,
    };
}

function mapAudioStreams(streams: FfprobeStream[]): AudioStreamInfo[] {
    return streams
        .filter(stream => stream.codec_type === 'audio')
        .map(stream => ({
            index: stream.index,
            codecName: stream.codec_name ?? '',
            channels: stream.channels,
            language: stream.tags?.language,
        }));
}

function mapSubtitleStreams(streams: FfprobeStream[]): SubtitleStreamInfo[] {
    return streams
        .filter(
            stream =>
                stream.codec_type === 'subtitle' || stream.codec_type === 'attachment' || stream.codec_type === 'data'
        )
        .map(stream => ({
            index: stream.index,
            codecName: stream.codec_name ?? '',
            kind: toSubtitleKind(stream),
            language: stream.tags?.language,
        }));
}

type DecodedProbe = {
    streams?: { nb_read_frames?: string }[];
    frames?: { best_effort_timestamp_time?: string; duration_time?: string }[];
};

function videoTiming(decoded: DecodedProbe, stream: FfprobeStream, origin: number, rate: number): VideoTiming {
    const count = Number(decoded.streams?.[0]?.nb_read_frames);
    const timeBase = parseFrameRate(stream.time_base) ?? 0;
    if (
        !Number.isInteger(count) ||
        count <= 0 ||
        decoded.frames?.length !== count ||
        !Number.isFinite(origin) ||
        !Number.isFinite(timeBase) ||
        timeBase <= 0 ||
        !Number.isFinite(rate) ||
        rate <= 0
    ) {
        throw new Error('Missing required video frame timing evidence');
    }
    // ffprobe emits decimal seconds; tolerate two timestamp ticks and decimal rounding.
    const precision = 2 * timeBase + 0.000002;
    let constantFrameRate = true;
    let previous = Number.NEGATIVE_INFINITY;
    let start = 0;
    let end = Number.NEGATIVE_INFINITY;
    for (const [index, frame] of decoded.frames.entries()) {
        const timestamp = Number(frame.best_effort_timestamp_time);
        const duration = Number(frame.duration_time);
        if (!Number.isFinite(timestamp) || !Number.isFinite(duration) || duration <= 0 || timestamp <= previous) {
            throw new Error('Invalid or missing video frame timing evidence');
        }
        if (
            Math.abs(duration - 1 / rate) > precision ||
            (index > 0 && Math.abs(timestamp - previous - 1 / rate) > precision)
        ) {
            constantFrameRate = false;
        }
        if (index === 0) {
            start = timestamp - origin;
        }
        end = Math.max(end, timestamp + duration - origin);
        previous = timestamp;
    }
    return { start, end, frameCount: count, constantFrameRate, timeBase };
}

export async function probeVideo(filePath: string): Promise<VideoProbe> {
    const { stdout } = await $`ffprobe -v error -print_format json -show_streams -show_format ${filePath}`;
    const parsed = JSON.parse(stdout as string) as FfprobeResponse;
    if (
        !Array.isArray(parsed.streams) ||
        !parsed.format?.format_name ||
        !Number.isFinite(Number(parsed.format.duration)) ||
        Number(parsed.format.duration) <= 0 ||
        parsed.streams.some(
            stream =>
                !Number.isInteger(stream.index) ||
                stream.index < 0 ||
                (['video', 'audio', 'subtitle'].includes(stream.codec_type) && !stream.codec_name)
        )
    ) {
        throw new Error('Invalid essential ffprobe data');
    }
    const videoStream = parsed.streams.find(stream => stream.codec_type === 'video');
    const video = mapVideoStream(videoStream);
    if (video && videoStream) {
        const decoded =
            await $`ffprobe -v error -select_streams v:0 -count_frames -show_frames -show_entries frame=best_effort_timestamp_time,duration_time:stream=nb_read_frames -of json ${filePath}`;
        if (decoded.stderr?.trim()) {
            throw new Error('Video frames cannot be read completely');
        }
        video.timing = videoTiming(
            JSON.parse(decoded.stdout) as DecodedProbe,
            videoStream,
            Number(parsed.format.start_time),
            video.frameRate
        );
    }
    const audio = mapAudioStreams(parsed.streams);
    const subtitles = mapSubtitleStreams(parsed.streams);

    return {
        container: parsed.format?.format_name?.split(',')[0],
        duration: Number(parsed.format?.duration),
        video,
        audio,
        subtitles,
        hasMetadata: hasMetadata(parsed.format, parsed.streams),
    };
}
