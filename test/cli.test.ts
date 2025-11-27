import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/media/filesystem.js', () => ({
    findMediaFiles: vi.fn(),
}));

vi.mock('../src/media/processor.js', () => ({
    processFiles: vi.fn(),
}));

import { cli } from '../src/cli.js';
import { findMediaFiles } from '../src/media/filesystem.js';
import { processFiles } from '../src/media/processor.js';

const findMediaFilesMock = vi.mocked(findMediaFiles);
const processFilesMock = vi.mocked(processFiles);

describe('cli', () => {
    it('uses process.cwd() as default and triggers processing', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'bloggymedia-cli-'));
        const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

        findMediaFilesMock.mockResolvedValue(['image.jpg']);
        processFilesMock.mockResolvedValue();

        try {
            await cli({});

            expect(cwdSpy).toHaveBeenCalled();
            expect(findMediaFilesMock).toHaveBeenCalledWith(tempDir);
            expect(processFilesMock).toHaveBeenCalledWith({ workingDir: tempDir, filePaths: ['image.jpg'] });
        } finally {
            cwdSpy.mockRestore();
            await rm(tempDir, { recursive: true, force: true });
            vi.clearAllMocks();
        }
    });

    it('uses a provided workingDir', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'bloggymedia-cli-'));

        findMediaFilesMock.mockResolvedValue(['video.mp4']);
        processFilesMock.mockResolvedValue();

        try {
            await cli({ workingDir: tempDir });

            expect(findMediaFilesMock).toHaveBeenCalledWith(tempDir);
            expect(processFilesMock).toHaveBeenCalledWith({ workingDir: tempDir, filePaths: ['video.mp4'] });
        } finally {
            await rm(tempDir, { recursive: true, force: true });
            vi.clearAllMocks();
        }
    });

    it('throws when the working directory does not exist', async () => {
        await expect(cli({ workingDir: '/path/that/does/not/exist' })).rejects.toThrow(
            'Working directory does not exist: /path/that/does/not/exist'
        );

        expect(findMediaFilesMock).not.toHaveBeenCalled();
        expect(processFilesMock).not.toHaveBeenCalled();
    });

    it('throws when workingDir is not a directory', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'bloggymedia-cli-'));
        const filePath = join(tempDir, 'file.txt');
        await writeFile(filePath, 'content');

        try {
            await expect(cli({ workingDir: filePath })).rejects.toThrow(
                `Provided workingDir is not a directory: ${filePath}`
            );

            expect(findMediaFilesMock).not.toHaveBeenCalled();
            expect(processFilesMock).not.toHaveBeenCalled();
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    });
});
