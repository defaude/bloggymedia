import { execFile } from 'node:child_process';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { expect, it } from 'vitest';

import { transcodeVideo } from '../src/adapters/ffmpeg.js';
import { copiedStreamPackets } from '../src/adapters/validate-video.js';
import { inspectVideo } from '../src/media/inspect.js';
import { validateVideo } from '../src/media/video-validation.js';

const exec = promisify(execFile);

it.each([
    { name: 'phone timestamp jitter near 60 fps', rate: '60', frames: 1582, offset: 0, expected: 633 },
    { name: 'a single frame shorter than the target interval', rate: '60', frames: 1, offset: 0, expected: 1 },
    { name: 'a half-second clip at 30 fps', rate: '30', frames: 15, offset: 0, expected: 12 },
    { name: 'rounding at both interval boundaries', rate: '60', frames: 4, offset: 0.02, expected: 3 },
    { name: 'a delayed video start relative to audio', rate: '60', frames: 90, offset: 0.25, expected: 36 },
    { name: 'unchanged fractional frame rate below the cap', rate: '24000/1001', frames: 48, offset: 0, expected: 48 },
])(
    'preserves presentation coverage for $name',
    async ({ rate, frames, offset, expected }) => {
        const root = await mkdtemp(join(tmpdir(), 'bloggymedia-resampling-'));
        const input = join(root, 'source.mp4');
        const output = join(root, 'output.mp4');
        try {
            await exec('ffmpeg', [
                '-v',
                'error',
                '-f',
                'lavfi',
                '-i',
                `testsrc2=size=64x48:rate=${rate}`,
                '-vf',
                frames === 1582 ? 'settb=1/90000,setpts=PTS+floor(N*0.39)' : `settb=1/90000,setpts=PTS+${offset}/TB`,
                '-frames:v',
                String(frames),
                '-enc_time_base',
                'filter',
                '-fps_mode',
                'passthrough',
                '-c:v',
                'libx264',
                '-bf',
                '0',
                input,
            ]);
            // Earlier audio keeps a delayed video's presentation offset observable.
            const withAudio = join(root, 'with-audio.mp4');
            const videoOnly = await inspectVideo(input);
            await exec('ffmpeg', [
                '-v',
                'error',
                '-copyts',
                '-i',
                input,
                '-f',
                'lavfi',
                '-i',
                `sine=sample_rate=48000:duration=${videoOnly.probe.duration}`,
                '-map',
                '0:v:0',
                '-map',
                '1:a:0',
                '-c:v',
                'copy',
                '-c:a',
                'aac',
                '-metadata',
                'title=strip me',
                withAudio,
            ]);
            const source = await inspectVideo(withAudio);
            const { plan } = source.decision;
            await (await open(output, 'wx')).close();
            await transcodeVideo({ input: withAudio, output, ...plan, subtitleIndices: plan.keepSubtitleIndices });
            const result = await inspectVideo(output);
            expect(() => validateVideo(source, result)).not.toThrow();
            expect(result.probe.video?.timing?.frameCount).toBe(expected);
            const expectedStart = Math.round(offset * plan.targetFrameRate) / plan.targetFrameRate;
            expect(result.probe.video?.timing?.start).toBeCloseTo(expectedStart, 4);
            expect(result.probe.video?.timing?.end).toBeCloseTo(expectedStart + expected / plan.targetFrameRate, 4);
            expect(await copiedStreamPackets(output, [1])).toEqual(await copiedStreamPackets(withAudio, [1]));
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    },
    30000
);
