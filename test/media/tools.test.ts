import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/media/inspect.js', () => ({
    inspectVideo: vi.fn(),
}));
vi.mock('zx', () => {
    const mockResult = { exitCode: 0, stdout: '' };
    const mock$ = vi.fn().mockReturnValue({ ...mockResult, nothrow: vi.fn().mockResolvedValue(mockResult) });
    return { $: mock$ };
});

import { $ } from 'zx';

import { detectMissingTools, MissingToolsError, processFiles } from '../../src/media/processor.js';

const zxMock = vi.mocked($);

describe('tool detection', () => {
    it('identifies missing tools', async () => {
        zxMock
            .mockImplementationOnce(() => ({
                exitCode: 0,
                stdout: '',
                nothrow: vi.fn().mockResolvedValue({ exitCode: 0 }),
            }))
            .mockImplementationOnce(() => ({
                exitCode: 1,
                stdout: '',
                nothrow: vi.fn().mockResolvedValue({ exitCode: 1 }),
            }))
            .mockImplementationOnce(() => ({
                exitCode: 0,
                stdout: '',
                nothrow: vi.fn().mockResolvedValue({ exitCode: 0 }),
            }));

        const missing = await detectMissingTools();
        expect(missing).toEqual(['ffmpeg']);
    });

    it('throws MissingToolsError when required tools are absent', async () => {
        const toolCheck = vi.fn().mockResolvedValue(['ffprobe']);
        await expect(
            processFiles({
                workingDir: '/tmp',
                filePaths: [],
                toolCheck,
            })
        ).rejects.toBeInstanceOf(MissingToolsError);
    });
});
