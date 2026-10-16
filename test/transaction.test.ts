import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async importOriginal => {
    const actual = await importOriginal<typeof import('node:fs/promises')>();
    return { ...actual, utimes: vi.fn(actual.utimes), rename: vi.fn(actual.rename), rm: vi.fn(actual.rm) };
});
vi.mock('node:crypto', async importOriginal => {
    const actual = await importOriginal<typeof import('node:crypto')>();
    return { ...actual, randomUUID: vi.fn(actual.randomUUID) };
});

import { randomUUID } from 'node:crypto';
import { mkdtemp, rename, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { replaceMedia } from '../src/media/transaction.js';

let dir: string;
let source: string;
beforeEach(async () => {
    vi.clearAllMocks();
    dir = await mkdtemp(join(tmpdir(), 'bloggymedia-transaction-'));
    source = join(dir, 'photo.jpg');
    await writeFile(source, 'source');
});
afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

it.each(['mtime', 'rename'])('keeps original and cleans its own output on %s failure', async phase => {
    const time = (await stat(source)).mtimeMs;
    const mock = phase === 'mtime' ? vi.mocked(utimes) : vi.mocked(rename);
    mock.mockRejectedValueOnce(new Error(`${phase} denied`));
    await expect(
        replaceMedia(
            source,
            async path => {
                await writeFile(path, 'new');
            },
            async () => {}
        )
    ).rejects.toThrow(phase);
    expect(await readFile(source, 'utf8')).toBe('source');
    expect((await stat(source)).mtimeMs).toBe(time);
    expect(await readdir(dir)).toEqual(['photo.jpg']);
});

it('retries exclusive name collisions and leaves foreign temporary files alone', async () => {
    vi.mocked(randomUUID).mockReturnValueOnce('11111111-1111-1111-1111-111111111111');
    const collision = join(dir, '.bloggymedia-11111111-1111-1111-1111-111111111111.jpg');
    await writeFile(collision, 'foreign');
    await writeFile(join(dir, 'photo.tmp.jpg'), 'also foreign');
    await replaceMedia(
        source,
        async path => {
            await writeFile(path, 'new');
        },
        async () => {}
    );
    expect(await readFile(collision, 'utf8')).toBe('foreign');
    expect(await readFile(join(dir, 'photo.tmp.jpg'), 'utf8')).toBe('also foreign');
    expect(await readFile(source, 'utf8')).toBe('new');
});

it('cleans its output on a handled interruption before commit', async () => {
    const controller = new AbortController();
    await expect(
        replaceMedia(
            source,
            async path => {
                await writeFile(path, 'partial');
                controller.abort(new Error('interrupted'));
            },
            async () => {},
            controller.signal
        )
    ).rejects.toThrow('interrupted');
    expect(await readFile(source, 'utf8')).toBe('source');
    expect(await readdir(dir)).toEqual(['photo.jpg']);
});

it('rejects a changed source and reports cleanup failure without deleting it', async () => {
    vi.mocked(rm).mockRejectedValueOnce(new Error('cleanup denied'));
    await expect(
        replaceMedia(
            source,
            async path => {
                await writeFile(path, 'output');
                await writeFile(source, 'external edit');
            },
            async () => {}
        )
    ).rejects.toThrow('cleanup failed');
    expect(await readFile(source, 'utf8')).toBe('external edit');
});
