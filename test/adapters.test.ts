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
        const normalized = Array.isArray(value) ? value.join(' ') : value ?? '';
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
    it('transcodes video to H.264 with height cap, preserves audio when present, and strips metadata quietly', async () => {
        zxMock.mockResolvedValueOnce({ exitCode: 0, stdout: '0\n' });

        await transcodeVideo({
            input: '/tmp/input.mov',
            output: '/tmp/output.mov',
            maxHeight: 720,
        });

        expect(zxMock).toHaveBeenCalledTimes(2);
        const probeCommand = commandFromCall(0);
        expect(probeCommand).toContain('ffprobe');
        expect(probeCommand).toContain('-select_streams a:0');

        const command = commandFromCall(1);
        expect(command).toContain('ffmpeg -hide_banner -loglevel warning');
        expect(command).toContain('-i /tmp/input.mov');
        expect(command).toContain("scale='-2:min(ih\\,720)'");
        expect(command).toContain('-r 24');
        expect(command).toContain('-c:v libx264');
        expect(command).toContain('-c:a aac');
        expect(command).toContain('-map_metadata -1');
        expect(command).toContain('/tmp/output.mov');
    });

    it('omits audio options when no audio stream is found', async () => {
        zxMock.mockResolvedValueOnce({ exitCode: 0, stdout: '' });

        await transcodeVideo({
            input: '/tmp/input.mov',
            output: '/tmp/output.mov',
            maxHeight: 720,
        });

        expect(zxMock).toHaveBeenCalledTimes(2);
        const command = commandFromCall(1);
        expect(command).toContain('-an');
        expect(command).not.toContain('-c:a aac');
    });
});
