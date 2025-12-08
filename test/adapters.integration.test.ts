import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { $ } from 'zx';

import { transcodeVideo } from '../src/adapters/ffmpeg.js';
import { resizeImage } from '../src/adapters/mogrify.js';
import { createWorkingDirFromFixtures } from './helpers/workdir.js';

async function ensureToolAvailable(tool: string) {
    const located = await $`command -v ${tool}`.nothrow();
    if (located.exitCode !== 0) {
        throw new Error(`${tool} is required for adapter integration tests`);
    }
}

describe.sequential('adapter integration', () => {
    it('resizes images using mogrify', async () => {
        await ensureToolAvailable('mogrify');
        await ensureToolAvailable('identify');

        const workdir = await createWorkingDirFromFixtures(['img-1600x1600.jpg']);
        const imagePath = join(workdir, 'img-1600x1600.jpg');

        try {
            await resizeImage({ input: imagePath, maxSize: '800x800' });

            const identifyResult = await $`identify -format "%w %h" ${imagePath}`;
            const [width, height] = identifyResult.stdout
                .trim()
                .split(' ')
                .map(value => Number.parseInt(value, 10));

            expect(width).toBeLessThanOrEqual(800);
            expect(height).toBeLessThanOrEqual(800);
        } finally {
            await rm(workdir, { recursive: true, force: true });
        }
    }, 15000);

    it('transcodes videos with ffmpeg respecting max height', async () => {
        await ensureToolAvailable('ffmpeg');
        await ensureToolAvailable('ffprobe');

        const workdir = await createWorkingDirFromFixtures(['vid-24fps-480x640-h264-noaudio.mp4']);
        const input = join(workdir, 'vid-24fps-480x640-h264-noaudio.mp4');
        const output = join(workdir, 'output.mp4');

        try {
            await transcodeVideo({ input, output, maxHeight: 320 });

            const metadata =
                await $`ffprobe -v error -select_streams v:0 -show_entries stream=height,codec_name -of json ${output}`;
            const { streams } = JSON.parse(metadata.stdout);
            const [videoStream] = streams as Array<{ height: number; codec_name: string }>;

            expect(videoStream.height).toBeLessThanOrEqual(320);
            expect(videoStream.codec_name).toBe('h264');

            const outputStats = await stat(output);
            expect(outputStats.size).toBeGreaterThan(0);
        } finally {
            await rm(workdir, { recursive: true, force: true });
        }
    }, 20000);
});
