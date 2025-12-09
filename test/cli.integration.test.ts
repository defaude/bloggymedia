import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/mogrify.js', () => ({
    resizeImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/adapters/ffmpeg.js', () => ({
    transcodeVideo: vi.fn(async ({ output }: { output: string }) => {
        await writeFile(output, 'transcoded');
    }),
}));

vi.mock('../src/media/inspect.js', () => ({
    inspectVideo: vi.fn(),
}));

import { transcodeVideo } from '../src/adapters/ffmpeg.js';
import { resizeImage } from '../src/adapters/mogrify.js';
import { cli } from '../src/cli.js';
import { ORIGINALS_DIR } from '../src/media/constants.js';
import { inspectVideo } from '../src/media/inspect.js';
import * as processor from '../src/media/processor.js';

const resizeImageMock = vi.mocked(resizeImage);
const transcodeVideoMock = vi.mocked(transcodeVideo);
const inspectVideoMock = vi.mocked(inspectVideo);

describe('cli integration', () => {
    it('processes a flat folder, creates backups, and reports summary with progress logs', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-int-'));
        const image = join(baseDir, 'photo.jpg');
        const video = join(baseDir, 'clip.mp4');
        const skipped = join(baseDir, 'skipped.jpg');
        const originalsDir = join(baseDir, ORIGINALS_DIR);

        await mkdir(originalsDir, { recursive: true });
        await writeFile(image, 'image-bytes');
        await writeFile(video, 'video-bytes');
        await writeFile(skipped, 'skip-me');
        await writeFile(join(originalsDir, 'skipped.jpg'), 'already-backed-up');

        const toolSpy = vi.spyOn(processor, 'detectMissingTools').mockResolvedValue([]);
        inspectVideoMock.mockResolvedValue({
            filePath: video,
            fileName: 'clip.mp4',
            orientation: 'landscape',
            probe: {
                container: 'mp4',
                video: { index: 0, width: 1920, height: 1080, codecName: 'hevc', frameRate: 30 },
                audio: [],
                subtitles: [],
                hasMetadata: false,
            },
            decision: {
                classification: 'process',
                reasons: ['codec', 'resolution', 'frameRate'],
                plan: {
                    targetWidth: 1280,
                    targetHeight: 720,
                    targetFrameRate: 24,
                    keepSubtitleIndices: [],
                    audioIndices: [],
                },
            },
        });
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        try {
            await cli({ workingDir: baseDir });

            expect(resizeImageMock).toHaveBeenCalledWith({ input: image, maxSize: '1200x1200' });
            expect(transcodeVideoMock).toHaveBeenCalled();

            const originals = await readFile(join(originalsDir, 'photo.jpg'), 'utf8');
            expect(originals).toBe('image-bytes');
            const videoBackup = await readFile(join(originalsDir, 'clip.mp4'), 'utf8');
            expect(videoBackup).toBe('video-bytes');

            const logs = logSpy.mock.calls.flat().join('\n');
            expect(logs).toContain('Processed: 2');
            expect(logs).toContain('Skipped:   0');
            expect(logs).toContain('Failed:    0');
            expect(logs).toMatch(/\[processed] photo\.jpg/);
            expect(logs).toMatch(/\[processed] clip\.mp4/);
        } finally {
            toolSpy.mockRestore();
            logSpy.mockRestore();
            await rm(baseDir, { recursive: true, force: true });
        }
    });

    it('continues on per-file failure and reports failed counts', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-fail-'));
        const image = join(baseDir, 'photo.jpg');
        const video = join(baseDir, 'clip.mp4');

        await writeFile(image, 'image-bytes');
        await writeFile(video, 'video-bytes');

        const toolSpy = vi.spyOn(processor, 'detectMissingTools').mockResolvedValue([]);
        inspectVideoMock.mockResolvedValue({
            filePath: video,
            fileName: 'clip.mp4',
            orientation: 'landscape',
            probe: {
                container: 'mp4',
                video: { index: 0, width: 1920, height: 1080, codecName: 'hevc', frameRate: 30 },
                audio: [],
                subtitles: [],
                hasMetadata: false,
            },
            decision: {
                classification: 'process',
                reasons: ['codec', 'resolution', 'frameRate'],
                plan: {
                    targetWidth: 1280,
                    targetHeight: 720,
                    targetFrameRate: 24,
                    keepSubtitleIndices: [],
                    audioIndices: [],
                },
            },
        });
        resizeImageMock.mockResolvedValue();
        transcodeVideoMock.mockRejectedValueOnce(new Error('ffmpeg error'));

        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        try {
            await cli({ workingDir: baseDir });

            const logs = logSpy.mock.calls.flat().join('\n');
            expect(logs).toContain('Processed: 1');
            expect(logs).toContain('Failed:    1');
            expect(logs).toMatch(/\[failed] clip\.mp4/);
            expect(logs).toMatch(/\[processed] photo\.jpg/);
        } finally {
            toolSpy.mockRestore();
            logSpy.mockRestore();
            await rm(baseDir, { recursive: true, force: true });
        }
    });
});
