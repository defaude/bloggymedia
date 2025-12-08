import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/media/filesystem.js', () => ({
    findMediaFiles: vi.fn(),
}));

vi.mock('../src/media/processor.js', () => ({
    processFiles: vi.fn(),
    MissingToolsError: class MockMissingToolsError extends Error {
        missingTools = ['mogrify'];
    },
}));

import { cli } from '../src/cli.js';
import { findMediaFiles } from '../src/media/filesystem.js';
import { MissingToolsError, processFiles } from '../src/media/processor.js';

const findMediaFilesMock = vi.mocked(findMediaFiles);
const processFilesMock = vi.mocked(processFiles);

afterEach(() => {
    vi.clearAllMocks();
});

describe('cli', () => {
    it('uses process.cwd() as default, greets, and prints summary', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'bloggymedia-cli-'));
        const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        findMediaFilesMock.mockResolvedValue(['image.jpg']);
        processFilesMock.mockResolvedValue({
            processed: 1,
            skipped: 0,
            failed: 0,
            files: [{ fileName: 'image.jpg', status: 'processed' }],
        });

        try {
            await cli({});

            expect(cwdSpy).toHaveBeenCalled();
            expect(findMediaFilesMock).toHaveBeenCalledWith(tempDir);
            expect(processFilesMock).toHaveBeenCalledWith({
                workingDir: tempDir,
                filePaths: ['image.jpg'],
                onProgress: expect.any(Function),
            });
            expect(logSpy).toHaveBeenCalledWith('Starting bloggymedia...');
            expect(logSpy).toHaveBeenCalledWith('--- Summary ---');
        } finally {
            cwdSpy.mockRestore();
            logSpy.mockRestore();
            await rm(tempDir, { recursive: true, force: true });
            vi.clearAllMocks();
        }
    });

    it('reports missing tools via console error', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'bloggymedia-cli-'));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        findMediaFilesMock.mockResolvedValue(['video.mp4']);
        processFilesMock.mockRejectedValue(new MissingToolsError(['mogrify']));

        await expect(cli({ workingDir: tempDir })).rejects.toBeInstanceOf(MissingToolsError);
        expect(errorSpy).toHaveBeenCalledWith('Missing required tools: mogrify');

        errorSpy.mockRestore();
        await rm(tempDir, { recursive: true, force: true });
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
