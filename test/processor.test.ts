import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/mogrify.js', () => ({
    resizeImage: vi.fn(),
}));

import { resizeImage } from '../src/adapters/mogrify.js';
import * as processor from '../src/media/processor.js';

const resizeImageMock = vi.mocked(resizeImage);

describe('classifyFile', () => {
    it('recognizes images, videos, and other files', () => {
        expect(processor.classifyFile('/path/photo.JPG')).toBe('image');
        expect(processor.classifyFile('/path/clip.Mp4')).toBe('video');
        expect(processor.classifyFile('/path/readme.md')).toBe('other');
    });
});

describe('handleImage', () => {
    it('creates .originals, copies the file, and calls mogrify via the adapter', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-image-'));
        const imagePath = join(baseDir, 'image.png');
        await writeFile(imagePath, 'pixel');

        resizeImageMock.mockResolvedValue();

        try {
            await processor.handleImage({ path: imagePath, type: 'image' }, baseDir);

            const originalsDir = join(baseDir, '.originals');
            const originalsFiles = await readdir(originalsDir);
            expect(originalsFiles).toContain('image.png');

            const backupContent = await readFile(join(originalsDir, 'image.png'), 'utf8');
            expect(backupContent).toBe('pixel');

            expect(resizeImageMock).toHaveBeenCalledWith({ input: imagePath, maxSize: '1200x1200' });

            // second run should not fail on EEXIST
            await processor.handleImage({ path: imagePath, type: 'image' }, baseDir);
        } finally {
            await rm(baseDir, { recursive: true, force: true });
            vi.clearAllMocks();
        }
    });
});

describe('handleVideo', () => {
    it('logs a placeholder message', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        try {
            await processor.handleVideo({ path: '/path/video.mov', type: 'video' });
            expect(logSpy).toHaveBeenCalledWith('Video handler placeholder for video.mov');
        } finally {
            logSpy.mockRestore();
        }
    });
});

describe('processFiles', () => {
    it('dispatches based on file type', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-process-'));
        const imagePath = join(baseDir, 'photo.jpeg');
        const videoPath = join(baseDir, 'clip.avi');
        const otherPath = join(baseDir, 'notes.txt');

        await mkdir(join(baseDir, '.originals'));
        await writeFile(imagePath, 'image');
        await writeFile(videoPath, 'video');
        await writeFile(otherPath, 'text');

        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        resizeImageMock.mockResolvedValue();

        try {
            await processor.processFiles({ workingDir: baseDir, filePaths: [imagePath, videoPath, otherPath] });

            const originalsFiles = await readdir(join(baseDir, '.originals'));
            expect(originalsFiles).toContain('photo.jpeg');
            expect(originalsFiles).not.toContain('clip.avi');
            expect(originalsFiles).not.toContain('notes.txt');

            expect(resizeImageMock).toHaveBeenCalledWith({ input: imagePath, maxSize: '1200x1200' });
            expect(logSpy).toHaveBeenCalledWith(`Video handler placeholder for ${basename(videoPath)}`);
        } finally {
            await rm(baseDir, { recursive: true, force: true });
            logSpy.mockRestore();
            vi.clearAllMocks();
        }
    });
});
