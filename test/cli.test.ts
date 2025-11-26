import { describe, expect, it, vi } from 'vitest';

import { cli } from '../src/cli.js';

describe('runCli', () => {
    it('verwendet process.cwd() als Standard und loggt den Pfad', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');

        try {
            await cli({});

            expect(cwdSpy).toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith('Hello, world! We are working in /mock/cwd');
        } finally {
            cwdSpy.mockRestore();
            logSpy.mockRestore();
        }
    });

    it('loggt ein übergebenes workingDir', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        try {
            await cli({ workingDir: '/tmp/media' });

            expect(logSpy).toHaveBeenCalledWith('Hello, world! We are working in /tmp/media');
        } finally {
            logSpy.mockRestore();
        }
    });

    it('nutzt den Standardpfad, wenn workingDir explizit undefined ist', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');

        try {
            await cli({ workingDir: undefined });

            expect(cwdSpy).toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith('Hello, world! We are working in /mock/cwd');
        } finally {
            cwdSpy.mockRestore();
            logSpy.mockRestore();
        }
    });
});
