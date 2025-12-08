import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ORIGINALS_DIR } from '../src/media/constants.js';
import { findMediaFiles } from '../src/media/filesystem.js';

describe('findMediaFiles', () => {
    it('returns only supported top-level media files and skips items with existing backups', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-files-'));
        const imageFile = join(baseDir, 'bild.jpg');
        const videoFile = join(baseDir, 'clip.mp4');
        const otherFile = join(baseDir, 'notes.txt');
        const subDir = join(baseDir, 'unterordner');
        const nestedFile = join(subDir, 'nested.mov');
        const originalsDir = join(baseDir, ORIGINALS_DIR);

        await writeFile(imageFile, 'bild');
        await writeFile(videoFile, 'video');
        await writeFile(otherFile, 'text');
        await mkdir(subDir);
        await writeFile(nestedFile, 'nested');
        await mkdir(originalsDir);
        await writeFile(join(originalsDir, 'clip.mp4'), 'backup');

        try {
            const files = await findMediaFiles(baseDir);

            expect(files).toContain(imageFile);
            expect(files).not.toContain(videoFile); // skipped because backup exists
            expect(files).not.toContain(nestedFile); // skipped because nested
            expect(files).not.toContain(otherFile); // skipped because non-media
            expect(files).toHaveLength(1);
        } finally {
            await rm(baseDir, { recursive: true, force: true });
        }
    });
});
