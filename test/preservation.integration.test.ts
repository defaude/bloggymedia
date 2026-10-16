import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import * as ffmpeg from '../src/adapters/ffmpeg.js';
import { copiedStreamPackets } from '../src/adapters/validate-video.js';
import { inspectVideo } from '../src/media/inspect.js';
import { processFiles } from '../src/media/processor.js';
import { validateVideo } from '../src/media/video-validation.js';

const exec = promisify(execFile);
let root: string;
let source: string;
let incomplete: string;
async function snapshot(path: string) {
    return {
        hash: createHash('sha256')
            .update(await readFile(path))
            .digest('hex'),
        mtime: (await stat(path)).mtimeMs,
    };
}
beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'bloggymedia-preservation-'));
    const fixtures = join(root, 'fixtures');
    await mkdir(fixtures);
    source = join(fixtures, 'source.mp4');
    incomplete = join(fixtures, 'incomplete.mp4');
    await exec('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=red:size=64x48:rate=12:duration=2',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=48000:duration=2',
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        '-metadata',
        'title=needs stripping',
        source,
    ]);
    await exec('ffmpeg', [
        '-v',
        'error',
        '-i',
        source,
        '-vf',
        'trim=end_frame=6,setpts=PTS-STARTPTS',
        '-c:v',
        'libx264',
        '-r',
        '12',
        '-c:a',
        'copy',
        '-map_metadata',
        '-1',
        incomplete,
    ]);
    await exec('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=red:size=64x48:rate=12:duration=2',
        '-vf',
        "select='not(mod(n,3))+eq(n,23)'",
        '-fps_mode',
        'vfr',
        '-c:v',
        'libx264',
        '-metadata',
        'title=needs stripping',
        join(fixtures, 'variable.mp4'),
    ]);
}, 30000);
afterAll(async () => {
    await rm(root, { recursive: true, force: true });
});
afterEach(() => {
    vi.restoreAllMocks();
});

it('rejects a half-second video with unchanged two-second audio and container duration', async () => {
    const before = await inspectVideo(source);
    const after = await inspectVideo(incomplete);
    expect(before.probe.duration).toBe(2);
    expect(before.probe.video?.timing).toMatchObject({ start: 0, end: 2, frameCount: 24, constantFrameRate: true });
    expect(after.probe.video?.timing).toMatchObject({ start: 0, end: 0.5, frameCount: 6 });
    expect(after.probe.duration).toBe(2);
    expect(await copiedStreamPackets(incomplete, [1])).toEqual(await copiedStreamPackets(source, [1]));
    const { stdout } = await exec('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-count_frames',
        '-show_entries',
        'stream=nb_read_frames,duration',
        '-of',
        'json',
        incomplete,
    ]);
    expect(JSON.parse(stdout).streams[0]).toMatchObject({ duration: '0.500000', nb_read_frames: '6' });
    expect(() => validateVideo(before, after)).toThrow(/video.*(coverage|frames)/i);
});

it('rejects that real incomplete output through the transaction and continues with the next input', async () => {
    const dir = join(root, 'transaction');
    await mkdir(dir);
    const input = join(dir, 'source.mp4');
    const next = join(dir, 'next.mp4');
    await copyFile(source, input);
    await copyFile(source, next);
    await utimes(input, 1600000000.123456, 1600000000.123456);
    const before = await snapshot(input);
    const actual = ffmpeg.transcodeVideo;
    vi.spyOn(ffmpeg, 'transcodeVideo')
        .mockImplementationOnce(async ({ output }) => {
            await copyFile(incomplete, output);
        })
        .mockImplementation(actual);
    const summary = await processFiles({ workingDir: dir, filePaths: [input, next] });
    expect(summary.files.map(file => file.status)).toEqual(['failed', 'processed']);
    expect(summary.files[0].reason).toMatch(/validate:.*video.*(coverage|frames)/i);
    expect(await snapshot(input)).toEqual(before);
    expect((await readdir(dir)).sort()).toEqual(['next.mp4', 'source.mp4']);
}, 30000);

it('accepts the existing resampling operation for real variable-rate input', async () => {
    const input = join(root, 'fixtures', 'variable.mp4');
    const source = await inspectVideo(input);
    expect(source.probe.video?.timing?.constantFrameRate).toBe(false);
    const { plan } = source.decision;
    const output = join(root, 'variable-output.mp4');
    await ffmpeg.transcodeVideo({
        input,
        output,
        targetWidth: plan.targetWidth,
        targetHeight: plan.targetHeight,
        targetFrameRate: plan.targetFrameRate,
        audioIndices: plan.audioIndices,
        subtitleIndices: plan.keepSubtitleIndices,
    });
    const result = await inspectVideo(output);
    expect(result.probe.video?.timing?.constantFrameRate).toBe(true);
    expect(() => validateVideo(source, result)).not.toThrow();
}, 30000);
