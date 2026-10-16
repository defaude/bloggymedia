import { expect, it } from 'vitest';

import type { VideoInspectionResult, VideoTiming } from '../../src/media/types.js';
import { validateVideo } from '../../src/media/video-validation.js';

const timing: VideoTiming = { start: 0, end: 2, frameCount: 24, constantFrameRate: true, timeBase: 1 / 12288 };
function inspection(rate = 12, times = timing): VideoInspectionResult {
    return {
        filePath: '',
        fileName: 'clip.mp4',
        orientation: 'landscape',
        probe: {
            container: 'mov',
            duration: 2,
            video: { index: 0, width: 64, height: 48, codecName: 'h264', frameRate: rate, timing: times },
            audio: [{ index: 1, codecName: 'aac', channels: 1 }],
            subtitles: [{ index: 2, codecName: 'mov_text', kind: 'text' }],
            hasMetadata: false,
        },
        decision: {
            classification: 'skip',
            reasons: [],
            plan: {
                targetWidth: 64,
                targetHeight: 48,
                targetFrameRate: Math.min(rate, 24),
                audioIndices: [1],
                keepSubtitleIndices: [2],
            },
        },
    };
}

it('accepts complete video with the planned streams and geometry', () => {
    expect(() => validateVideo(inspection(), inspection())).not.toThrow();
});
it('rejects short video despite unchanged audio and container duration', () => {
    expect(() => validateVideo(inspection(), inspection(12, { ...timing, end: 0.5, frameCount: 6 }))).toThrow(
        'Video coverage'
    );
});
it('uses the decoded count even if timestamps misleadingly cover the source interval', () => {
    expect(() => validateVideo(inspection(), inspection(12, { ...timing, frameCount: 6 }))).toThrow('Video frames');
});
it('accepts planned frame reduction instead of requiring identical counts', () => {
    const source = inspection(30, { ...timing, frameCount: 60 });
    expect(() => validateVideo(source, inspection(24, { ...timing, frameCount: 48 }))).not.toThrow();
});
it('permits a boundary frame from CFR resampling but rejects additional losses', () => {
    const source = inspection(30, { ...timing, frameCount: 60 });
    expect(() => validateVideo(source, inspection(24, { ...timing, frameCount: 47 }))).not.toThrow();
    expect(() => validateVideo(source, inspection(24, { ...timing, frameCount: 46 }))).toThrow('Video frames');
    expect(() => validateVideo(source, inspection(24, { ...timing, end: 50 / 24, frameCount: 50 }))).not.toThrow();
    expect(() => validateVideo(source, inspection(24, { ...timing, frameCount: 51 }))).toThrow('Video frames');
});
it('uses temporal coverage and planned output rate for variable-rate sources', () => {
    const source = inspection(12, { ...timing, constantFrameRate: false, frameCount: 18 });
    expect(() => validateVideo(source, inspection())).not.toThrow();
    expect(() => validateVideo(source, inspection(12, { ...timing, frameCount: 18 }))).toThrow('Video frames');
});
it('rejects a shifted presentation interval relative to the container start', () => {
    expect(() => validateVideo(inspection(), inspection(12, { ...timing, start: 0.5 }))).toThrow('Video coverage');
});
it.each(['source', 'output'])('requires timing evidence for %s', missing => {
    const source = inspection();
    const output = inspection();
    const target = missing === 'source' ? source : output;
    if (target.probe.video) {
        target.probe.video.timing = undefined;
    }
    expect(() => validateVideo(source, output)).toThrow('Missing required video coverage');
});
it.each(['geometry', 'audio', 'subtitles'])('still rejects loss of %s', missing => {
    const output = inspection();
    if (missing === 'geometry' && output.probe.video) {
        output.probe.video.width = 32;
    }
    if (missing === 'audio') {
        output.probe.audio = [];
    }
    if (missing === 'subtitles') {
        output.probe.subtitles = [];
    }
    expect(() => validateVideo(inspection(), output)).toThrow('geometry, rate or streams');
});
