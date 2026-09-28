import { $ } from 'zx';

import { SUBTITLE_TEXT_CODECS } from '../media/constants.js';
import type { AudioStreamInfo, SubtitleKind, SubtitleStreamInfo, VideoProbe, VideoStreamInfo } from '../media/types.js';

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
};

type FfprobeFormat = {
    format_name?: string;
    tags?: Record<string, string>;
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
            channels: (stream as unknown as { channels?: number }).channels,
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

export async function probeVideo(filePath: string): Promise<VideoProbe> {
    const { stdout } = await $`ffprobe -v error -print_format json -show_streams -show_format ${filePath}`;
    const parsed = JSON.parse(stdout as string) as FfprobeResponse;
    const videoStream = parsed.streams.find(stream => stream.codec_type === 'video');
    const video = mapVideoStream(videoStream);
    const audio = mapAudioStreams(parsed.streams);
    const subtitles = mapSubtitleStreams(parsed.streams);

    return {
        container: parsed.format?.format_name?.split(',')[0],
        video,
        audio,
        subtitles,
        hasMetadata: hasMetadata(parsed.format, parsed.streams),
    };
}
