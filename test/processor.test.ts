import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/mogrify.js', () => ({
    resizeImage: vi.fn(),
}));

vi.mock('../src/adapters/ffmpeg.js', () => ({
    transcodeVideo: vi.fn(),
}));

import { transcodeVideo } from '../src/adapters/ffmpeg.js';
import { resizeImage } from '../src/adapters/mogrify.js';
import { ORIGINALS_DIR } from '../src/media/constants.js';
import * as processor from '../src/media/processor.js';

const resizeImageMock = vi.mocked(resizeImage);
const transcodeVideoMock = vi.mocked(transcodeVideo);

describe('processFiles', () => {
    it('backs up and processes images and videos, skipping unsupported types', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-process-'));
        const imagePath = join(baseDir, 'photo.jpeg');
        const videoPath = join(baseDir, 'clip.mp4');
        const otherPath = join(baseDir, 'notes.txt');

        await writeFile(imagePath, 'image');
        await writeFile(videoPath, 'video');
        await writeFile(otherPath, 'text');

        resizeImageMock.mockResolvedValue();
        transcodeVideoMock.mockImplementation(async ({ input, output }) => {
            await writeFile(output, `transcoded:${basename(input)}`);
        });
        try {
            const summary = await processor.processFiles({
                workingDir: baseDir,
                filePaths: [imagePath, videoPath, otherPath],
                toolCheck: async () => [],
            });

            const originalsFiles = await access(join(baseDir, ORIGINALS_DIR, 'photo.jpeg'));
            expect(originalsFiles).toBeUndefined();

            expect(summary.processed).toBe(2);
            expect(summary.skipped).toBe(1);
            expect(summary.failed).toBe(0);

            expect(resizeImageMock).toHaveBeenCalledWith({ input: imagePath, maxSize: '1200x1200' });
            expect(transcodeVideoMock).toHaveBeenCalled();
            expect(summary.files.find(file => file.fileName === 'notes.txt')?.status).toBe('skipped');
        } finally {
            await rm(baseDir, { recursive: true, force: true });
            vi.clearAllMocks();
        }
    });

    it('skips files that already have backups', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-backup-'));
        const imagePath = join(baseDir, 'photo.jpeg');
        const originals = join(baseDir, ORIGINALS_DIR);
        await mkdir(originals);
        await writeFile(imagePath, 'image');
        await writeFile(join(originals, 'photo.jpeg'), 'backup');

        resizeImageMock.mockResolvedValue();
        try {
            const summary = await processor.processFiles({ workingDir: baseDir, filePaths: [imagePath] });
            expect(summary.processed).toBe(0);
            expect(summary.skipped).toBe(1);
            expect(summary.files[0]?.reason).toBe('backup-exists');
            expect(resizeImageMock).not.toHaveBeenCalled();
        } finally {
            await rm(baseDir, { recursive: true, force: true });
            vi.clearAllMocks();
        }
    });

    it('throws MissingToolsError when required tools are absent', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-missing-tools-'));
        const imagePath = join(baseDir, 'photo.jpeg');
        await writeFile(imagePath, 'image');

        await expect(
            processor.processFiles({
                workingDir: baseDir,
                filePaths: [imagePath],
                toolCheck: async () => ['mogrify'],
            })
        ).rejects.toBeInstanceOf(processor.MissingToolsError);

        await rm(baseDir, { recursive: true, force: true });
        vi.clearAllMocks();
    });
});
