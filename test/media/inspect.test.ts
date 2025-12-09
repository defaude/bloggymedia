import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/adapters/ffprobe.js', () => ({
    probeVideo: vi.fn(),
}));

import { probeVideo } from '../../src/adapters/ffprobe.js';
import { inspectVideo } from '../../src/media/inspect.js';

const probeMock = vi.mocked(probeVideo);

beforeEach(() => {
    probeMock.mockReset();
});

describe('inspectVideo', () => {
    it('classifies compliant videos as skip with no reasons', async () => {
        probeMock.mockResolvedValue({
            container: 'mov',
            video: { index: 0, width: 1280, height: 720, codecName: 'h264', frameRate: 23.976 },
            audio: [],
            subtitles: [],
            hasMetadata: false,
        });

        const result = await inspectVideo('/tmp/video.mov');

        expect(result.decision.classification).toBe('skip');
        expect(result.decision.reasons).toEqual([]);
        expect(result.decision.plan.targetFrameRate).toBeCloseTo(23.976);
    });

    it('triggers processing for codec, resolution, frame rate, metadata, and non-text subtitles', async () => {
        probeMock.mockResolvedValue({
            container: 'mov',
            video: { index: 0, width: 1920, height: 1080, codecName: 'hevc', frameRate: 30 },
            audio: [{ index: 1, codecName: 'aac' }],
            subtitles: [
                { index: 2, codecName: 'hdmv_pgs_subtitle', kind: 'binary' },
                { index: 3, codecName: 'srt', kind: 'text' },
            ],
            hasMetadata: true,
        });

        const result = await inspectVideo('/tmp/video.mov');

        expect(result.decision.classification).toBe('process');
        expect(result.decision.reasons).toEqual(
            expect.arrayContaining(['codec', 'resolution', 'frameRate', 'metadata', 'subtitleAttachment'])
        );
        expect(result.decision.plan.targetWidth).toBe(1280);
        expect(result.decision.plan.targetHeight).toBe(720);
        expect(result.decision.plan.targetFrameRate).toBe(24);
        expect(result.decision.plan.audioIndices).toEqual([1]);
        expect(result.decision.plan.keepSubtitleIndices).toEqual([3]);
    });

    it('ignores structural format tags when deciding metadata presence', async () => {
        probeMock.mockResolvedValue({
            container: 'mp4',
            video: { index: 0, width: 640, height: 360, codecName: 'h264', frameRate: 23.976 },
            audio: [],
            subtitles: [],
            hasMetadata: false,
        } as unknown as ReturnType<typeof probeMock>);

        const result = await inspectVideo('/tmp/structural.mp4');

        expect(result.decision.classification).toBe('skip');
        expect(result.decision.reasons).toEqual([]);
    });

    it('ignores structural stream tags (language/handler/vendor/encoder) when deciding metadata presence', async () => {
        probeMock.mockResolvedValue({
            container: 'mp4',
            video: { index: 0, width: 640, height: 360, codecName: 'h264', frameRate: 23.976 },
            audio: [],
            subtitles: [],
            hasMetadata: false,
            streams: [
                {
                    index: 0,
                    codec_type: 'video',
                    tags: {
                        language: 'und',
                        handler_name: 'VideoHandler',
                        vendor_id: '[0][0][0][0]',
                        encoder: 'Lavc62.11.100 libx264',
                    },
                },
            ],
        } as unknown as ReturnType<typeof probeMock>);

        const result = await inspectVideo('/tmp/structural-stream.mp4');

        expect(result.decision.classification).toBe('skip');
        expect(result.decision.reasons).toEqual([]);
    });

    it('caps portrait videos to 720x1280 without upscaling', async () => {
        probeMock.mockResolvedValue({
            container: 'mp4',
            video: { index: 0, width: 720, height: 1600, codecName: 'h264', frameRate: 24.01 },
            audio: [],
            subtitles: [],
            hasMetadata: false,
        });

        const result = await inspectVideo('/tmp/vertical.mp4');

        expect(result.orientation).toBe('portrait');
        expect(result.decision.reasons).toContain('resolution');
        expect(result.decision.reasons).toContain('frameRate');
        expect(result.decision.plan.targetWidth).toBe(576); // 720 * (1280/1600)
        expect(result.decision.plan.targetHeight).toBe(1280);
        expect(result.decision.plan.targetFrameRate).toBe(24);
    });
});
