import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/mogrify.js', () => ({
    resizeImage: vi.fn(),
}));

vi.mock('../src/adapters/ffmpeg.js', () => ({
    transcodeVideo: vi.fn(),
}));

vi.mock('../src/media/inspect.js', () => ({
    inspectVideo: vi.fn(),
}));

import { transcodeVideo } from '../src/adapters/ffmpeg.js';
import { resizeImage } from '../src/adapters/mogrify.js';
import { ORIGINALS_DIR } from '../src/media/constants.js';
import { inspectVideo } from '../src/media/inspect.js';
import * as processor from '../src/media/processor.js';

const resizeImageMock = vi.mocked(resizeImage);
const transcodeVideoMock = vi.mocked(transcodeVideo);
const inspectVideoMock = vi.mocked(inspectVideo);

describe('processFiles', () => {
    it('skips unsupported files', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-process-'));
        const otherPath = join(baseDir, 'notes.txt');
        await writeFile(otherPath, 'text');

        const summary = await processor.processFiles({
            workingDir: baseDir,
            filePaths: [otherPath],
            toolCheck: async () => [],
        });

        expect(summary.processed).toBe(0);
        expect(summary.skipped).toBe(1);
        expect(summary.files[0]?.reason).toBe('unsupported');

        await rm(baseDir, { recursive: true, force: true });
    });

    it('skips compliant videos without creating backups', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-skip-'));
        const videoPath = join(baseDir, 'clip.mp4');
        await writeFile(videoPath, 'video');

        inspectVideoMock.mockResolvedValue({
            filePath: videoPath,
            fileName: 'clip.mp4',
            orientation: 'landscape',
            probe: {
                container: 'mov',
                video: { index: 0, width: 1280, height: 720, codecName: 'h264', frameRate: 23.976 },
                audio: [],
                subtitles: [],
                hasMetadata: false,
            },
            decision: {
                classification: 'skip',
                reasons: [],
                plan: {
                    targetWidth: 1280,
                    targetHeight: 720,
                    targetFrameRate: 23.976,
                    keepSubtitleIndices: [],
                    audioIndices: [],
                },
            },
        });

        const summary = await processor.processFiles({
            workingDir: baseDir,
            filePaths: [videoPath],
            toolCheck: async () => [],
        });

        expect(summary.processed).toBe(0);
        expect(summary.skipped).toBe(1);
        expect(summary.files[0]?.reason).toBe('compliant');
        await expect(access(join(baseDir, ORIGINALS_DIR, 'clip.mp4'))).rejects.toThrow();

        expect(transcodeVideoMock).not.toHaveBeenCalled();
        await rm(baseDir, { recursive: true, force: true });
    });

    it('backs up and processes non-compliant videos with reasons recorded', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-process-video-'));
        const videoPath = join(baseDir, 'clip.mp4');
        await writeFile(videoPath, 'video');

        inspectVideoMock.mockResolvedValue({
            filePath: videoPath,
            fileName: 'clip.mp4',
            orientation: 'landscape',
            probe: {
                container: 'mov',
                video: { index: 0, width: 1920, height: 1080, codecName: 'hevc', frameRate: 30 },
                audio: [{ index: 1, codecName: 'aac' }],
                subtitles: [],
                hasMetadata: true,
            },
            decision: {
                classification: 'process',
                reasons: ['codec', 'resolution', 'frameRate', 'metadata'],
                plan: {
                    targetWidth: 1280,
                    targetHeight: 720,
                    targetFrameRate: 24,
                    keepSubtitleIndices: [],
                    audioIndices: [1],
                },
            },
        });

        transcodeVideoMock.mockImplementation(async ({ output }) => {
            await writeFile(output, 'processed');
        });

        const summary = await processor.processFiles({
            workingDir: baseDir,
            filePaths: [videoPath],
            toolCheck: async () => [],
        });

        expect(summary.processed).toBe(1);
        expect(summary.skipped).toBe(0);
        expect(summary.files[0]?.reasons).toEqual(['codec', 'resolution', 'frameRate', 'metadata']);
        await expect(access(join(baseDir, ORIGINALS_DIR, 'clip.mp4'))).resolves.toBeUndefined();

        expect(transcodeVideoMock).toHaveBeenCalledWith(
            expect.objectContaining({
                input: videoPath,
                targetWidth: 1280,
                targetHeight: 720,
                targetFrameRate: 24,
                audioIndices: [1],
                subtitleIndices: [],
            })
        );

        await rm(baseDir, { recursive: true, force: true });
    });

    it('restores originals when processing fails', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-restore-'));
        const videoPath = join(baseDir, 'clip.mp4');
        const originalContent = 'original video content';
        await writeFile(videoPath, originalContent);

        inspectVideoMock.mockResolvedValue({
            filePath: videoPath,
            fileName: 'clip.mp4',
            orientation: 'landscape',
            probe: {
                container: 'mov',
                video: { index: 0, width: 1920, height: 1080, codecName: 'hevc', frameRate: 30 },
                audio: [],
                subtitles: [],
                hasMetadata: false,
            },
            decision: {
                classification: 'process',
                reasons: ['codec'],
                plan: {
                    targetWidth: 1280,
                    targetHeight: 720,
                    targetFrameRate: 24,
                    keepSubtitleIndices: [],
                    audioIndices: [],
                },
            },
        });

        transcodeVideoMock.mockImplementation(async ({ input }) => {
            await writeFile(input, 'corrupted');
            throw new Error('transcode failure');
        });

        const summary = await processor.processFiles({
            workingDir: baseDir,
            filePaths: [videoPath],
            toolCheck: async () => [],
        });

        expect(summary.failed).toBe(1);
        expect(summary.files[0]?.status).toBe('failed');

        const restoredContent = await readFile(videoPath, 'utf8');
        expect(restoredContent).toBe(originalContent);

        await rm(baseDir, { recursive: true, force: true });
    });
});
