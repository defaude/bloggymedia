import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('zx', () => {
    const mock$ = vi.fn().mockResolvedValue({ exitCode: 0, stdout: '' });
    return { $: mock$ };
});

import { $ } from 'zx';

import { transcodeVideo } from '../src/adapters/ffmpeg.js';
import { resizeImage } from '../src/adapters/mogrify.js';

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
    zxMock.mockResolvedValue({ exitCode: 0, stdout: '' });
});

describe('adapters/mogrify', () => {
    it('strips metadata and resizes to the provided max size', async () => {
        await resizeImage({ input: '/tmp/photo.png', maxSize: '1200x1200' });

        expect(zxMock).toHaveBeenCalledTimes(1);
        const command = commandFromCall(0);
        expect(command).toContain('mogrify -strip -resize 1200x1200\\>');
        expect(command).toContain('/tmp/photo.png');
    });
});

describe('adapters/ffmpeg', () => {
    it('transcodes video to H.264 with caps, preserving audio/subtitle mappings and stripping metadata', async () => {
        zxMock.mockResolvedValue({ exitCode: 0, stdout: '' });

        await transcodeVideo({
            input: '/tmp/input.mov',
            output: '/tmp/output.mov',
            targetWidth: 1280,
            targetHeight: 720,
            targetFrameRate: 24,
            audioIndices: [1],
            subtitleIndices: [2],
        });

        expect(zxMock).toHaveBeenCalledTimes(1);
        const command = commandFromCall(0);
        expect(command).toContain('ffmpeg -hide_banner -loglevel warning');
        expect(command).toContain('-i /tmp/input.mov');
        expect(command).toContain('scale=1280:720');
        expect(command).toContain('-r 24');
        expect(command).toContain('-c:v libx264');
        expect(command).toContain('-c:a copy');
        expect(command).toContain('-c:s copy');
        expect(command).toContain('-map 0:v:0');
        expect(command).toContain('-map 0:1');
        expect(command).toContain('-map 0:2');
        expect(command).toContain('-map_metadata -1');
        expect(command).toContain('-map_chapters -1');
        expect(command).toContain('/tmp/output.mov');
    });

    it('omits audio/subtitle streams when none provided', async () => {
        zxMock.mockResolvedValue({ exitCode: 0, stdout: '' });

        await transcodeVideo({
            input: '/tmp/input.mov',
            output: '/tmp/output.mov',
            targetWidth: 640,
            targetHeight: 480,
            targetFrameRate: 23.976,
            audioIndices: [],
            subtitleIndices: [],
        });

        expect(zxMock).toHaveBeenCalledTimes(1);
        const command = commandFromCall(0);
        expect(command).toContain('-an');
        expect(command).toContain('-sn');
        expect(command).toContain('scale=640:480');
        expect(command).toContain('-r 23.976');
        expect(command).not.toContain('-c:a copy');
        expect(command).not.toContain('-c:s copy');
    });
});
