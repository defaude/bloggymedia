import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { transcodeVideo } from '../src/adapters/ffmpeg.js';
import { probeImage } from '../src/adapters/image.js';
import { resizeImage } from '../src/adapters/mogrify.js';
import { copiedStreamPackets } from '../src/adapters/validate-video.js';
import { inspectImage } from '../src/media/image.js';
import { inspectVideo } from '../src/media/inspect.js';
import { pgsSubtitle } from './helpers/pgs.js';

const exec = promisify(execFile);
const binary = resolve('dist/index.js');
let root: string;
let fixtures: string;
const names = [
    'large.jpg',
    'small.jpeg',
    'transparent.PNG',
    'transparent.webp',
    'animation.gif',
    'animation.webp',
    'landscape.mp4',
    'portrait.mp4',
    'low.mov',
    'streams.mp4',
    'metadata.mp4',
    'data.mov',
    'alternate.m4v',
];

async function command(tool: string, args: string[]) {
    return exec(tool, args, { maxBuffer: 16 * 1024 * 1024 });
}
async function snapshot(path: string) {
    return {
        sha256: createHash('sha256')
            .update(await readFile(path))
            .digest('hex'),
        mtime: (await stat(path)).mtimeMs,
    };
}
async function copyFixtures(files: string[]) {
    const dir = await mkdtemp(join(root, 'CLI with spaces '));
    for (const name of files) {
        await copyFile(join(fixtures, name), join(dir, name));
        await utimes(join(dir, name), 1600000000.123456, 1600000000.123456);
    }
    return dir;
}
async function run(dir: string, args = [dir], env = process.env) {
    return exec(process.execPath, [binary, ...args], { cwd: dir, env, maxBuffer: 16 * 1024 * 1024 });
}

beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'bloggymedia-real-'));
    fixtures = join(root, 'fixtures');
    await mkdir(fixtures);
    await command('npm', ['run', 'build']);
    await command('magick', [
        '-size',
        '1600x800',
        'xc:red',
        '-set',
        'comment',
        'remove me',
        join(fixtures, 'large.jpg'),
    ]);
    await command('magick', ['-size', '60x40', 'xc:red', '-strip', join(fixtures, 'small.jpeg')]);
    await writeFile(
        join(fixtures, 'metadata.xmp'),
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>'
    );
    for (const name of ['transparent.PNG', 'transparent.webp']) {
        await command('magick', [
            '-size',
            '64x48',
            'xc:none',
            '-fill',
            'red',
            '-draw',
            'rectangle 2,2 20,20',
            '-set',
            'comment',
            'remove me',
            '-profile',
            join(fixtures, 'metadata.xmp'),
            join(fixtures, name),
        ]);
    }
    for (const name of ['animation.gif', 'animation.webp']) {
        await command('magick', [
            '-delay',
            '10',
            '-size',
            '1600x800',
            'xc:red',
            '-delay',
            '20',
            '-size',
            '1600x800',
            'xc:blue',
            '-loop',
            '3',
            '-set',
            'comment',
            'remove me',
            '-profile',
            join(fixtures, 'metadata.xmp'),
            join(fixtures, name),
        ]);
    }
    await command('magick', [
        '(',
        '-size',
        '1600x800',
        'xc:red',
        '-set',
        'page',
        '1600x800+0+0',
        '-set',
        'delay',
        '10',
        '-set',
        'dispose',
        'None',
        ')',
        '(',
        '-size',
        '101x91',
        'xc:blue',
        '-set',
        'page',
        '1600x800+10+10',
        '-set',
        'delay',
        '20',
        '-set',
        'dispose',
        'Background',
        ')',
        '-loop',
        '3',
        join(fixtures, 'partial.gif'),
    ]);
    for (const [name, size, rate, codec] of [
        ['landscape.mp4', '1600x900', '30', 'libx264'],
        ['portrait.mp4', '900x1600', '24', 'libx264'],
        ['low.mov', '64x48', '12', 'mpeg4'],
    ]) {
        await command('ffmpeg', [
            '-v',
            'error',
            '-f',
            'lavfi',
            '-i',
            `color=red:size=${size}:rate=${rate}`,
            '-t',
            '0.5',
            '-c:v',
            codec,
            '-metadata',
            'title=remove me',
            join(fixtures, name),
        ]);
    }
    await writeFile(join(fixtures, 'text.srt'), '1\n00:00:00,000 --> 00:00:00,400\nHello subtitles\n');
    await command('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=blue:size=64x48:rate=12',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=48000',
        '-i',
        join(fixtures, 'text.srt'),
        '-t',
        '0.5',
        '-c:v',
        'mpeg4',
        '-c:a',
        'aac',
        '-c:s',
        'mov_text',
        '-metadata',
        'title=remove me',
        join(fixtures, 'streams.mp4'),
    ]);
    await command('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=red:size=64x48:rate=12',
        '-t',
        '0.5',
        '-c:v',
        'libx264',
        '-metadata',
        'title=remove me',
        join(fixtures, 'metadata.mp4'),
    ]);
    await copyFile(join(fixtures, 'metadata.mp4'), join(fixtures, 'alternate.m4v'));
    await writeFile(join(fixtures, 'payload.bin'), 'data stream');
    await command('ffmpeg', [
        '-v',
        'error',
        '-i',
        join(fixtures, 'streams.mp4'),
        '-f',
        'data',
        '-i',
        join(fixtures, 'payload.bin'),
        '-map',
        '0',
        '-map',
        '1',
        '-c',
        'copy',
        '-tag:d',
        'gpmd',
        join(fixtures, 'data.mov'),
    ]);
    for (const ext of ['mkv', 'avi']) {
        await command('ffmpeg', [
            '-v',
            'error',
            '-f',
            'lavfi',
            '-i',
            'color=red:size=64x48:rate=12',
            '-t',
            '0.5',
            '-c:v',
            'mpeg4',
            join(fixtures, `conflict.${ext}`),
        ]);
    }
    await writeFile(join(fixtures, 'captions.sup'), pgsSubtitle);
    await command('ffmpeg', [
        '-v',
        'error',
        '-i',
        join(fixtures, 'conflict.mkv'),
        '-i',
        join(fixtures, 'captions.sup'),
        '-map',
        '0:v',
        '-map',
        '1',
        '-c',
        'copy',
        '-attach',
        join(fixtures, 'payload.bin'),
        '-metadata:s:t',
        'mimetype=application/octet-stream',
        join(fixtures, 'excluded.mkv'),
    ]);
}, 60000);
afterAll(async () => {
    await rm(root, { recursive: true, force: true });
});

describe('built CLI with real media tools', () => {
    it('processes a format matrix and skips every successful result on the second run', async () => {
        const dir = await copyFixtures(names);
        const before = await Promise.all(names.map(name => snapshot(join(dir, name))));
        const frames = await probeImage(join(dir, 'animation.gif'));
        const audioBefore = await copiedStreamPackets(join(dir, 'streams.mp4'), [1, 2]);
        const first = await run(dir);
        expect(first.stdout).toContain('Failed:    0');
        expect(first.stdout).toContain('Processed: 12');
        expect(first.stdout).toContain('[skipped] small.jpeg');
        for (const [i, name] of names.entries()) {
            expect(Math.abs((await stat(join(dir, name))).mtimeMs - before[i].mtime)).toBeLessThan(0.002);
            if (/\.(mp4|mov|m4v)$/.test(name)) {
                expect((await inspectVideo(join(dir, name))).decision.classification).toBe('skip');
            } else {
                expect((await inspectImage(join(dir, name))).reasons).toEqual([]);
            }
        }
        const animation = await probeImage(join(dir, 'animation.gif'));
        expect(animation).toHaveLength(frames.length);
        expect(animation.map(frame => frame.delay)).toEqual(frames.map(frame => frame.delay));
        expect(animation.map(frame => frame.geometry)).toEqual([
            { width: 1200, height: 600, x: 0, y: 0 },
            { width: 1200, height: 600, x: 0, y: 0 },
        ]);
        const webpAnimation = await probeImage(join(dir, 'animation.webp'));
        expect(webpAnimation.map(frame => frame.delay)).toEqual(['10x100', '20x100']);
        expect(webpAnimation.map(frame => frame.iterations)).toEqual([3, 3]);
        expect((await probeImage(join(dir, 'large.jpg')))[0].geometry).toMatchObject({ width: 1200, height: 600 });
        for (const name of ['transparent.PNG', 'transparent.webp']) {
            expect((await probeImage(join(dir, name)))[0].channelStatistics?.alpha?.min).toBe(0);
        }
        expect(await copiedStreamPackets(join(dir, 'streams.mp4'), [1, 2])).toEqual(audioBefore);
        const low = (await inspectVideo(join(dir, 'low.mov'))).probe.video;
        expect(low).toMatchObject({ width: 64, height: 48, frameRate: 12 });
        expect((await inspectVideo(join(dir, 'landscape.mp4'))).probe.video).toMatchObject({
            width: 1280,
            height: 720,
            frameRate: 24,
        });
        expect((await inspectVideo(join(dir, 'portrait.mp4'))).probe.video).toMatchObject({ width: 720, height: 1280 });
        const afterFirst = await Promise.all(names.map(name => snapshot(join(dir, name))));
        expect(afterFirst[names.indexOf('small.jpeg')]).toEqual(before[names.indexOf('small.jpeg')]);
        const wrappers = join(root, 'encoder guards');
        await mkdir(wrappers);
        for (const tool of ['mogrify', 'ffmpeg']) {
            await writeFile(join(wrappers, tool), '#!/bin/sh\necho unexpected-writer >&2\nexit 99\n', { mode: 0o755 });
        }
        const second = await run(dir, [dir], { ...process.env, PATH: `${wrappers}:${process.env.PATH}` });
        expect(second.stdout).toContain('Processed: 0');
        expect(second.stdout).toContain('Skipped:   13');
        expect(second.stdout).toContain('Failed:    0');
        expect(second.stderr).not.toContain('unexpected-writer');
        expect(await Promise.all(names.map(name => snapshot(join(dir, name))))).toEqual(afterFirst);
        expect((await readdir(dir)).sort()).toEqual([...names].sort());
    }, 60000);

    it('safely rejects partial-frame GIF resizing with unchanged source and complete cleanup', async () => {
        const dir = await copyFixtures(['partial.gif']);
        const path = join(dir, 'partial.gif');
        const before = await snapshot(path);
        const frames = await probeImage(path);
        expect(
            frames.map(frame => ({
                geometry: frame.geometry,
                canvas: frame.pageGeometry,
                delay: frame.delay,
                dispose: frame.dispose,
            }))
        ).toEqual([
            {
                geometry: { width: 1600, height: 800, x: 0, y: 0 },
                canvas: { width: 1600, height: 800, x: 0, y: 0 },
                delay: '10x100',
                dispose: 'None',
            },
            {
                geometry: { width: 101, height: 91, x: 0, y: 0 },
                canvas: { width: 1600, height: 800, x: 10, y: 10 },
                delay: '20x100',
                dispose: 'Background',
            },
        ]);
        const output = join(fixtures, 'partial-output.gif');
        await copyFile(path, output);
        await resizeImage({ input: output, maxSize: '1200x1200' });
        const resized = await probeImage(output);
        expect(resized[0].geometry).toMatchObject({ width: 1200, height: 600 });
        expect(resized[1].geometry).toMatchObject({ width: 101, height: 91 });
        expect(resized[1].pageGeometry).toEqual({ width: 1200, height: 600, x: 10, y: 10 });
        expect(resized.map(frame => [frame.delay, frame.dispose])).toEqual(
            frames.map(frame => [frame.delay, frame.dispose])
        );
        const result = await run(dir);
        expect(result.stdout).toContain('Failed:    1');
        expect(result.stdout).toContain('Partial-frame animation resizing');
        expect(await snapshot(path)).toEqual(before);
        expect(await readdir(dir)).toEqual(['partial.gif']);
    }, 30000);

    it('continues after real corrupt media; preserves originals, foreign tmp files, nested files, audio and symlinks', async () => {
        const dir = await copyFixtures(['large.jpg', 'small.jpeg']);
        await mkdir(join(dir, '.originals'));
        await copyFile(join(fixtures, 'large.jpg'), join(dir, '.originals', 'large.jpg'));
        await copyFile(join(fixtures, 'small.jpeg'), join(dir, 'photo.tmp.jpg'));
        await copyFile(join(fixtures, 'low.mov'), join(dir, 'clip.tmp.mp4'));
        await mkdir(join(dir, 'nested'));
        await copyFile(join(fixtures, 'large.jpg'), join(dir, 'nested', 'large.jpg'));
        await symlink(join(fixtures, 'large.jpg'), join(dir, 'link.jpg'));
        await writeFile(join(dir, '00-broken.jpg'), 'broken image');
        await writeFile(join(dir, '01-broken.mp4'), 'broken video');
        const corrupt = await readFile(join(fixtures, 'metadata.mp4'));
        for (let offset = 0; offset + 8 <= corrupt.length; ) {
            const size = corrupt.readUInt32BE(offset);
            if (size < 8) {
                break;
            }
            if (corrupt.toString('ascii', offset + 4, offset + 8) === 'mdat') {
                corrupt.fill(0, offset + 8, offset + size);
                break;
            }
            offset += size;
        }
        await writeFile(join(dir, '02-broken-body.mp4'), corrupt);
        await writeFile(join(dir, 'song.mp3'), 'standalone audio');
        await writeFile(join(dir, 'notes.txt'), 'notes');
        // Foreign tmp media are legitimate discovery candidates; use compliant media for untouched checks.
        await rm(join(dir, 'clip.tmp.mp4'));
        await command('ffmpeg', [
            '-v',
            'error',
            '-f',
            'lavfi',
            '-i',
            'color=red:size=64x48:rate=12',
            '-t',
            '0.25',
            '-c:v',
            'libx264',
            join(dir, 'clip.tmp.mp4'),
        ]);
        const protectedPaths = [
            '.originals/large.jpg',
            'photo.tmp.jpg',
            'clip.tmp.mp4',
            'nested/large.jpg',
            'song.mp3',
            'notes.txt',
            '00-broken.jpg',
            '01-broken.mp4',
            '02-broken-body.mp4',
        ].map(name => join(dir, name));
        const before = await Promise.all(protectedPaths.map(snapshot));
        const result = await run(dir, []);
        expect(result.stdout).toContain('Failed:    3');
        expect(result.stdout).toContain('[processed] large.jpg');
        expect(result.stdout).toContain('inspect:');
        expect(await Promise.all(protectedPaths.map(snapshot))).toEqual(before);
        expect((await readdir(dir)).filter(name => name.startsWith('.bloggymedia-'))).toEqual([]);
    }, 30000);

    it('retains MKV/AVI inputs when the unchanged encoder produces relevant structural tags', async () => {
        const files = ['conflict.mkv', 'conflict.avi', 'excluded.mkv'];
        const dir = await copyFixtures(files);
        const before = await Promise.all(files.map(name => snapshot(join(dir, name))));
        const result = await run(dir);
        expect(result.stdout).toContain('Failed:    3');
        expect(result.stdout).toContain('Video output remains non-compliant: metadata');
        expect(await Promise.all(files.map(name => snapshot(join(dir, name))))).toEqual(before);
        expect((await readdir(dir)).sort()).toEqual([...files].sort());
        const source = await inspectVideo(join(dir, 'excluded.mkv'));
        expect(source.probe.subtitles.map(sub => sub.kind)).toEqual(['binary', 'attachment']);
        const { plan } = source.decision;
        const output = join(dir, 'inspected-output.mkv');
        await transcodeVideo({
            input: join(dir, 'excluded.mkv'),
            output,
            targetWidth: plan.targetWidth,
            targetHeight: plan.targetHeight,
            targetFrameRate: plan.targetFrameRate,
            audioIndices: plan.audioIndices,
            subtitleIndices: plan.keepSubtitleIndices,
        });
        const inspected = await inspectVideo(output);
        expect(inspected.probe.subtitles).toEqual([]);
        expect(inspected.decision.reasons).toEqual(['metadata']);
    });

    it('preserves the input and cleans a partial output on SIGTERM', async () => {
        const dir = await copyFixtures(['large.jpg']);
        const before = await snapshot(join(dir, 'large.jpg'));
        const wrappers = await mkdtemp(join(root, 'interrupt-'));
        const ready = join(wrappers, 'ready');
        await writeFile(
            join(wrappers, 'mogrify'),
            '#!/bin/sh\nprintf partial > "$4"\nprintf ready > "$BLOGGYMEDIA_READY"\nsleep 30\n',
            { mode: 0o755 }
        );
        const child = spawn(process.execPath, [binary, dir], {
            env: { ...process.env, PATH: `${wrappers}:${process.env.PATH}`, BLOGGYMEDIA_READY: ready },
            stdio: 'pipe',
        });
        let output = '';
        child.stdout.on('data', chunk => {
            output += chunk.toString();
        });
        child.stderr.resume();
        const closed = new Promise<number | null>((resolve, reject) => {
            child.on('error', reject);
            child.on('close', resolve);
        });
        try {
            const deadline = Date.now() + 10000;
            while (!(await stat(ready).catch(() => null))) {
                if (Date.now() > deadline) {
                    throw new Error('Encoder wrapper did not start');
                }
                await delay(20);
            }
            child.kill('SIGTERM');
            expect(await closed).toBe(143);
            expect(output).toContain('Failed:    1');
            expect(await snapshot(join(dir, 'large.jpg'))).toEqual(before);
            expect(await readdir(dir)).toEqual(['large.jpg']);
        } finally {
            if (child.exitCode === null) {
                child.kill('SIGKILL');
            }
        }
    }, 20000);

    it('handles empty directories and rejects flags, extra arguments and invalid directories', async () => {
        const dir = await copyFixtures([]);
        expect((await run(dir, [])).stdout).toContain('No media files');
        await writeFile(join(dir, 'song.mp3'), 'audio');
        expect((await run(dir)).stdout).toContain('No media files');
        for (const args of [['--verbose'], [dir, dir], [join(dir, 'missing')], [join(dir, 'song.mp3')]]) {
            await expect(run(dir, args)).rejects.toMatchObject({ code: 1 });
        }
        expect(await readdir(dir)).toEqual(['song.mp3']);
    });
});
