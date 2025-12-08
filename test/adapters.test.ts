import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('zx', () => {
    const mock$ = vi.fn().mockResolvedValue({ exitCode: 0 });
    return { $: mock$ };
});

import { $ } from 'zx';

import { transcodeVideo } from '../src/adapters/ffmpeg.js';
import { resizeImage } from '../src/adapters/mogrify.js';

const zxMock = vi.mocked($);

beforeEach(() => {
    zxMock.mockClear();
});

describe('adapters/mogrify', () => {
    it('strips metadata and resizes to the provided max size', async () => {
        await resizeImage({ input: '/tmp/photo.png', maxSize: '1200x1200' });

        expect(zxMock).toHaveBeenCalledTimes(1);
        const [strings, ...expr] = zxMock.mock.calls[0] as unknown[];
        const command = (strings as TemplateStringsArray).reduce(
            (acc, part, index) => acc + part + (expr[index] ?? ''),
            ''
        );
        expect(command).toContain('mogrify -strip -resize 1200x1200\\>');
        expect(command).toContain('/tmp/photo.png');
    });
});

describe('adapters/ffmpeg', () => {
    it('transcodes video to H.264 with height cap and strips metadata', async () => {
        await transcodeVideo({
            input: '/tmp/input.mov',
            output: '/tmp/output.mov',
            maxHeight: 720,
        });

        expect(zxMock).toHaveBeenCalledTimes(1);
        const [strings, ...expr] = zxMock.mock.calls[0] as unknown[];
        const command = (strings as TemplateStringsArray).reduce(
            (acc, part, index) => acc + part + (expr[index] ?? ''),
            ''
        );

        expect(command).toContain('-i /tmp/input.mov');
        expect(command).toContain("scale='-2:min(ih\\,720)'");
        expect(command).toContain('-c:v libx264');
        expect(command).toContain('-map_metadata -1');
        expect(command).toContain('/tmp/output.mov');
    });
});
