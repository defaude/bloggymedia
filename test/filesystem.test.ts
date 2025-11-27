import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findMediaFiles } from '../src/media/filesystem.js';

describe('findMediaFiles', () => {
    it('lists only top-level files and ignores subfolders', async () => {
        const baseDir = await mkdtemp(join(tmpdir(), 'bloggymedia-files-'));
        const topLevelFile = join(baseDir, 'bild.jpg');
        const subDir = join(baseDir, 'unterordner');
        const nestedFile = join(subDir, 'video.mp4');

        await writeFile(topLevelFile, 'bild');
        await mkdir(subDir);
        await writeFile(nestedFile, 'video');

        try {
            const files = await findMediaFiles(baseDir);

            expect(files).toContain(topLevelFile);
            expect(files).not.toContain(nestedFile);
            expect(files).toHaveLength(1);
        } finally {
            await rm(baseDir, { recursive: true, force: true });
        }
    });
});
