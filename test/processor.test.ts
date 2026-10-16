import { mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/mogrify.js', () => ({ resizeImage: vi.fn() }));
vi.mock('../src/media/image.js', () => ({ inspectImage: vi.fn(), validateImage: vi.fn() }));
vi.mock('../src/media/inspect.js', () => ({ inspectVideo: vi.fn() }));
vi.mock('../src/adapters/ffmpeg.js', () => ({ transcodeVideo: vi.fn() }));
vi.mock('../src/adapters/validate-video.js', () => ({ copiedStreamPackets: vi.fn() }));

import { transcodeVideo } from '../src/adapters/ffmpeg.js';
import { resizeImage } from '../src/adapters/mogrify.js';
import { copiedStreamPackets } from '../src/adapters/validate-video.js';
import { inspectImage, validateImage } from '../src/media/image.js';
import { inspectVideo } from '../src/media/inspect.js';
import { processFiles } from '../src/media/processor.js';
import type { VideoInspectionResult } from '../src/media/types.js';

let dir: string;
let image: string;
const imageState = { frames: [], reasons: ['metadata'] };
const video: VideoInspectionResult = {
    filePath: '',
    fileName: 'clip.mp4',
    orientation: 'landscape',
    probe: {
        container: 'mov',
        video: {
            index: 0,
            width: 640,
            height: 480,
            frameRate: 20,
            codecName: 'h264',
            timing: { start: 0, end: 2, frameCount: 40, constantFrameRate: true, timeBase: 1 / 10240 },
        },
        audio: [{ index: 1, codecName: 'aac' }],
        subtitles: [],
        hasMetadata: true,
    },
    decision: {
        classification: 'process',
        reasons: ['metadata'],
        plan: { targetWidth: 640, targetHeight: 480, targetFrameRate: 20, audioIndices: [1], keepSubtitleIndices: [] },
    },
};

beforeEach(async () => {
    vi.resetAllMocks();
    dir = await mkdtemp(join(tmpdir(), 'bloggymedia-process-'));
    image = join(dir, 'photo.jpg');
    await writeFile(image, 'source');
    await utimes(image, 1600000000.123456, 1600000000.123456);
    vi.mocked(inspectImage).mockResolvedValue(imageState);
    vi.mocked(resizeImage).mockImplementation(async ({ input }) => {
        await writeFile(input, 'processed');
    });
    vi.mocked(copiedStreamPackets).mockResolvedValue([['hash']]);
});
afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

function run(paths = [image], onProgress?: () => void) {
    return processFiles({ workingDir: dir, filePaths: paths, toolCheck: async () => [], onProgress });
}

async function unchanged(path: string, mtime: number) {
    expect(await readFile(path, 'utf8')).toBe('source');
    expect((await stat(path)).mtimeMs).toBe(mtime);
    expect((await readdir(dir)).filter(name => name.startsWith('.bloggymedia-'))).toEqual([]);
}

describe('processFiles', () => {
    it('skips compliant images without writer calls or timestamp changes', async () => {
        const time = (await stat(image)).mtimeMs;
        vi.mocked(inspectImage).mockResolvedValue({ frames: [], reasons: [] });
        expect((await run()).files[0]).toMatchObject({ status: 'skipped', reason: 'compliant' });
        expect(resizeImage).not.toHaveBeenCalled();
        await unchanged(image, time);
    });

    it('keeps all processing reasons in results and progress', async () => {
        vi.mocked(inspectImage).mockResolvedValue({ frames: [], reasons: ['resolution', 'metadata'] });
        const onProgress = vi.fn();
        const summary = await run([image], onProgress);
        expect(summary.files[0]).toMatchObject({ status: 'processed', reason: 'resolution, metadata' });
        expect(onProgress).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'resolution, metadata', status: 'processed' })
        );
    });

    it('writes only a private temporary copy, validates, and preserves fractional mtime', async () => {
        const time = (await stat(image)).mtimeMs;
        const summary = await run();
        expect(summary.processed).toBe(1);
        const temp = vi.mocked(resizeImage).mock.calls[0][0].input;
        expect(temp).not.toBe(image);
        expect(temp).toMatch(/\.bloggymedia-.*\.jpg$/);
        expect(validateImage).toHaveBeenCalled();
        expect(await readFile(image, 'utf8')).toBe('processed');
        expect(Math.abs((await stat(image)).mtimeMs - time)).toBeLessThan(0.002);
        expect(await readdir(dir)).toEqual(['photo.jpg']);
    });

    it.each(['tool', 'validation', 'unreadable', 'empty'])(
        'preserves source on %s error and continues',
        async failure => {
            const time = (await stat(image)).mtimeMs;
            const next = join(dir, 'next.jpg');
            await writeFile(next, 'source');
            if (failure === 'tool') {
                vi.mocked(resizeImage).mockImplementationOnce(async ({ input }) => {
                    await writeFile(input, 'partial');
                    throw new Error('tool failed');
                });
            }
            if (failure === 'validation') {
                vi.mocked(validateImage).mockImplementationOnce(() => {
                    throw new Error('bad output');
                });
            }
            if (failure === 'unreadable') {
                vi.mocked(inspectImage)
                    .mockResolvedValueOnce(imageState)
                    .mockRejectedValueOnce(new Error('unreadable'));
            }
            if (failure === 'empty') {
                vi.mocked(resizeImage).mockImplementationOnce(async ({ input }) => {
                    await writeFile(input, '');
                });
            }
            const summary = await run([image, next]);
            expect(summary.files.map(file => file.status)).toEqual(['failed', 'processed']);
            await unchanged(image, time);
        }
    );

    it('rejects an otherwise compliant video that lost its expected audio', async () => {
        const path = join(dir, 'clip.mp4');
        await writeFile(path, 'source');
        const time = (await stat(path)).mtimeMs;
        vi.mocked(inspectVideo)
            .mockResolvedValueOnce(video)
            .mockResolvedValueOnce({
                ...video,
                probe: { ...video.probe, audio: [], hasMetadata: false },
                decision: { ...video.decision, classification: 'skip', reasons: [] },
            });
        vi.mocked(transcodeVideo).mockImplementation(async ({ output }) => {
            await writeFile(output, 'incomplete');
        });
        expect((await run([path])).failed).toBe(1);
        await unchanged(path, time);
    });

    it('rejects changed copied stream contents before replacement', async () => {
        const path = join(dir, 'clip.mp4');
        await writeFile(path, 'source');
        const time = (await stat(path)).mtimeMs;
        vi.mocked(inspectVideo)
            .mockResolvedValueOnce(video)
            .mockResolvedValueOnce({
                ...video,
                probe: { ...video.probe, hasMetadata: false },
                decision: { ...video.decision, classification: 'skip', reasons: [] },
            });
        vi.mocked(copiedStreamPackets)
            .mockResolvedValueOnce([['source hash']])
            .mockResolvedValueOnce([['different hash']]);
        vi.mocked(transcodeVideo).mockImplementation(async ({ output }) => {
            await writeFile(output, 'wrong audio');
        });
        const summary = await run([path]);
        expect(summary.files[0].reason).toContain('packet contents changed');
        await unchanged(path, time);
    });

    it('preserves committed output if progress reporting throws', async () => {
        await expect(
            run([image], () => {
                throw new Error('report failed');
            })
        ).rejects.toThrow('report failed');
        expect(await readFile(image, 'utf8')).toBe('processed');
        expect(await readdir(dir)).toEqual(['photo.jpg']);
    });

    it('skips unsupported files and rejects paths outside the selected directory', async () => {
        const other = join(dir, 'notes.txt');
        await writeFile(other, 'text');
        expect((await run([other])).files[0].reason).toBe('unsupported');
        expect((await run([join(dir, '..', 'outside.jpg')])).failed).toBe(1);
    });
});
