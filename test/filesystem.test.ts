import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findMediaFiles } from '../src/media/filesystem.js';

describe('findMediaFiles', () => {
    it('returns top-level regular media regardless of existing originals', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-files-'));
        const imageFile = join(baseDir, 'bild.jpg');
        const videoFile = join(baseDir, 'clip.mp4');
        const otherFile = join(baseDir, 'notes.txt');
        const subDir = join(baseDir, 'unterordner');
        const nestedFile = join(subDir, 'nested.mov');
        const originalsDir = join(baseDir, '.originals');

        await writeFile(imageFile, 'bild');
        await writeFile(videoFile, 'video');
        await writeFile(otherFile, 'text');
        await symlink(imageFile, join(baseDir, 'link.jpg'));
        await writeFile(join(baseDir, 'UPPER.PNG'), 'upper');
        await mkdir(subDir);
        await writeFile(nestedFile, 'nested');
        await mkdir(originalsDir);
        await writeFile(join(originalsDir, 'clip.mp4'), 'backup');

        try {
            const files = await findMediaFiles(baseDir);

            expect(files).toContain(imageFile);
            expect(files).toContain(videoFile);
            expect(files).not.toContain(nestedFile); // skipped because nested
            expect(files).not.toContain(otherFile); // skipped because non-media
            expect(files).not.toContain(join(baseDir, 'link.jpg'));
            expect(files).toHaveLength(3);
        } finally {
            await rm(baseDir, { recursive: true, force: true });
        }
    });
});
