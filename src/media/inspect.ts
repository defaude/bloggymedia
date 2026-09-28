import { basename } from 'node:path';

import { probeVideo } from '../adapters/ffprobe.js';
import {
    SUBTITLE_TEXT_CODECS,
    VIDEO_MAX_FRAMERATE,
    VIDEO_MAX_HEIGHT,
    VIDEO_MAX_PORTRAIT_HEIGHT,
    VIDEO_MAX_PORTRAIT_WIDTH,
    VIDEO_MAX_WIDTH,
    VIDEO_TARGET_CODEC_NAME,
} from './constants.js';
import type {
    Orientation,
    TriggerReason,
    VideoInspectionDecision,
    VideoInspectionResult,
    VideoProbe,
    VideoStreamInfo,
} from './types.js';

const EPSILON = 0.0001;

function orientationOf(video: VideoStreamInfo): Orientation {
    return video.width >= video.height ? 'landscape' : 'portrait';
}

function even(value: number): number {
    return Math.max(2, Math.floor(value / 2) * 2);
}

function computeTargetResolution(video: VideoStreamInfo, orientation: Orientation) {
    const capWidth = orientation === 'landscape' ? VIDEO_MAX_WIDTH : VIDEO_MAX_PORTRAIT_WIDTH;
    const capHeight = orientation === 'landscape' ? VIDEO_MAX_HEIGHT : VIDEO_MAX_PORTRAIT_HEIGHT;

    const scale = Math.min(capWidth / (video.width || 1), capHeight / (video.height || 1), 1);
    const targetWidth = even(video.width * scale);
    const targetHeight = even(video.height * scale);

    return { targetWidth, targetHeight };
}

function frameRateTriggers(video: VideoStreamInfo): boolean {
    return video.frameRate > VIDEO_MAX_FRAMERATE + EPSILON;
}

function hasNonTextSubtitles(probe: VideoProbe): boolean {
    return probe.subtitles.some(sub => sub.kind !== 'text' || !SUBTITLE_TEXT_CODECS.has(sub.codecName.toLowerCase()));
}

function buildDecision(probe: VideoProbe, video: VideoStreamInfo, orientation: Orientation): VideoInspectionDecision {
    const reasons: TriggerReason[] = [];

    if (video.codecName.toLowerCase() !== VIDEO_TARGET_CODEC_NAME) {
        reasons.push('codec');
    }

    const { targetWidth, targetHeight } = computeTargetResolution(video, orientation);
    if (video.width > targetWidth + EPSILON || video.height > targetHeight + EPSILON) {
        reasons.push('resolution');
    }

    if (frameRateTriggers(video)) {
        reasons.push('frameRate');
    }

    if (probe.hasMetadata) {
        reasons.push('metadata');
    }

    if (hasNonTextSubtitles(probe)) {
        reasons.push('subtitleAttachment');
    }

    const keepSubtitleIndices = probe.subtitles.filter(sub => sub.kind === 'text').map(sub => sub.index);
    const audioIndices = probe.audio.map(audio => audio.index);

    const plan = {
        targetWidth,
        targetHeight,
        targetFrameRate: frameRateTriggers(video) ? VIDEO_MAX_FRAMERATE : video.frameRate || VIDEO_MAX_FRAMERATE,
        keepSubtitleIndices,
        audioIndices,
    };

    return {
        classification: reasons.length === 0 ? 'skip' : 'process',
        reasons,
        plan,
    };
}

export async function inspectVideo(filePath: string): Promise<VideoInspectionResult> {
    const probe = await probeVideo(filePath);
    if (!probe.video) {
        throw new Error(`No video stream found in ${filePath}`);
    }

    const orientation = orientationOf(probe.video);
    const decision = buildDecision(probe, probe.video, orientation);

    return {
        filePath,
        fileName: basename(filePath),
        probe,
        orientation,
        decision,
    };
}
