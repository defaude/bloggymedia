import type { VideoInspectionResult, VideoTiming } from './types.js';

export function validateVideo(source: VideoInspectionResult, output: VideoInspectionResult) {
    if (output.decision.classification !== 'skip') {
        throw new Error(`Video output remains non-compliant: ${output.decision.reasons.join(', ')}`);
    }
    const { plan } = source.decision;
    const video = output.probe.video;
    const expectedSubtitles = source.probe.subtitles.filter(sub => plan.keepSubtitleIndices.includes(sub.index));
    if (
        !video ||
        video.width !== plan.targetWidth ||
        video.height !== plan.targetHeight ||
        Math.abs(video.frameRate - plan.targetFrameRate) > 0.001 ||
        source.probe.container !== output.probe.container ||
        source.probe.audio.length !== output.probe.audio.length ||
        expectedSubtitles.length !== output.probe.subtitles.length ||
        source.probe.audio.some(
            (audio, i) =>
                audio.codecName !== output.probe.audio[i].codecName || audio.channels !== output.probe.audio[i].channels
        ) ||
        expectedSubtitles.some((sub, i) => sub.codecName !== output.probe.subtitles[i].codecName)
    ) {
        throw new Error('Video output is non-compliant or does not preserve the planned geometry, rate or streams');
    }
    validateVideoTiming(source, output);
    if (
        source.probe.duration !== undefined &&
        (!Number.isFinite(output.probe.duration) ||
            !Number.isFinite(source.probe.duration) ||
            Math.abs(source.probe.duration - (output.probe.duration ?? 0)) > Math.max(0.1, 2 / plan.targetFrameRate))
    ) {
        throw new Error('Video output duration does not match source');
    }
}

function validTiming(timing: VideoTiming | undefined): timing is VideoTiming {
    return (
        timing !== undefined &&
        [timing.start, timing.end, timing.timeBase].every(Number.isFinite) &&
        timing.end > timing.start &&
        timing.timeBase > 0 &&
        Number.isInteger(timing.frameCount) &&
        timing.frameCount > 0 &&
        typeof timing.constantFrameRate === 'boolean'
    );
}

function validateVideoTiming(source: VideoInspectionResult, output: VideoInspectionResult) {
    const before = source.probe.video?.timing;
    const after = output.probe.video?.timing;
    if (!validTiming(before) || !validTiming(after)) {
        throw new Error('Missing required video coverage and frame count evidence');
    }
    const sourceRate = source.probe.video?.frameRate ?? 0;
    const targetRate = source.decision.plan.targetFrameRate;
    if (![sourceRate, targetRate].every(rate => Number.isFinite(rate) && rate > 0)) {
        throw new Error('Missing required video frame rate evidence');
    }
    // The existing ffmpeg -r frame synchronizer can retain two queued boundary
    // frames (measured: 15 frames/30fps -> 14 frames/24fps). A shortened interval
    // gets only one target-frame rounding allowance, not that extension allowance.
    const precision = before.timeBase + after.timeBase + 0.000002;
    const boundary = 1 / targetRate;
    if (
        Math.abs(before.start - after.start) > boundary + precision ||
        before.end - after.end > boundary + precision ||
        after.end - before.end > 2 * boundary + precision
    ) {
        throw new Error('Video coverage does not match the source presentation interval');
    }
    if (before.constantFrameRate && Math.abs(sourceRate - targetRate) < 0.0001) {
        if (after.frameCount !== before.frameCount) {
            throw new Error('Video frames lost or added at unchanged constant frame rate');
        }
    } else {
        // VFR input is resampled by the existing -r operation; original frame count
        // is not invariant. Allow one rounded frame fewer or two queued frames more.
        const expected = (before.end - before.start) * targetRate;
        const rounding = targetRate * precision;
        if (after.frameCount < expected - 1 - rounding || after.frameCount > expected + 2 + rounding) {
            throw new Error('Video frames do not match the planned resampling duration');
        }
    }
}
