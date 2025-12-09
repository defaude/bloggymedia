import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/adapters/ffmpeg.js', async importOriginal => {
    const actual = await importOriginal();
    return actual;
});

vi.mock('zx', () => {
    const mock$ = vi.fn().mockResolvedValue({ exitCode: 0, stdout: '' });
    return { $: mock$ };
});

import { $ } from 'zx';

import { transcodeVideo } from '../../src/adapters/ffmpeg.js';

const zxMock = vi.mocked($);

function commandFromCall(callIndex: number): string {
    const [strings, ...expr] = zxMock.mock.calls[callIndex] as unknown[];
    return (strings as TemplateStringsArray).reduce((acc, part, index) => {
        const value = expr[index];
        const normalized = Array.isArray(value) ? value.join(' ') : (value ?? '');
        return acc + part + normalized;
    }, '');
}

beforeEach(() => {
    zxMock.mockClear();
});

describe('ffmpeg adapter (audio/subtitle preservation)', () => {
    it('maps all audio tracks, keeps text subtitles, and drops attachments/data', async () => {
        zxMock.mockResolvedValue({ exitCode: 0, stdout: '' });

        await transcodeVideo({
            input: '/tmp/input.mov',
            output: '/tmp/output.mov',
            targetWidth: 1280,
            targetHeight: 720,
            targetFrameRate: 24,
            audioIndices: [1, 2],
            subtitleIndices: [3],
        });

        const command = commandFromCall(0);
        expect(command).toContain('-map 0:v:0');
        expect(command).toContain('-map 0:1');
        expect(command).toContain('-map 0:2');
        expect(command).toContain('-map 0:3');
        expect(command).toContain('-c:a copy');
        expect(command).toContain('-c:s copy');
        expect(command).not.toContain('-sn');
    });

    it('omits subtitle mapping when none provided', async () => {
        zxMock.mockResolvedValue({ exitCode: 0, stdout: '' });

        await transcodeVideo({
            input: '/tmp/input.mov',
            output: '/tmp/output.mov',
            targetWidth: 640,
            targetHeight: 360,
            targetFrameRate: 24,
            audioIndices: [1],
            subtitleIndices: [],
        });

        const command = commandFromCall(0);
        expect(command).toContain('-sn');
        expect(command).not.toContain('-map 0:2');
    });
});
