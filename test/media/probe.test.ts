import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('zx', () => ({ $: vi.fn() }));

import { $ } from 'zx';

import { probeVideo } from '../../src/adapters/ffprobe.js';
import { probeImage } from '../../src/adapters/image.js';

const stream = {
    index: 0,
    codec_type: 'video',
    codec_name: 'h264',
    width: 64,
    height: 48,
    avg_frame_rate: '12/1',
    time_base: '1/12288',
};
const format = { format_name: 'mov', duration: '0.5', start_time: '0', tags: { encoder: 'technical' } };
beforeEach(() => {
    vi.resetAllMocks();
});

it.each([
    {},
    { streams: [], format: {} },
    { streams: [stream], format: { ...format, duration: 'NaN' } },
    { streams: [stream], format: { ...format, duration: '0' } },
    { streams: [{ ...stream, index: -1 }], format },
    { streams: [{ ...stream, codec_name: '' }], format },
])('rejects malformed essential video probe responses %#', async response => {
    vi.mocked($).mockResolvedValue({ stdout: JSON.stringify(response) });
    await expect(probeVideo('/tmp/clip.mp4')).rejects.toThrow('essential ffprobe');
});

const decoded = {
    streams: [{ nb_read_frames: '6' }],
    frames: Array.from({ length: 6 }, (_, i) => ({
        best_effort_timestamp_time: String(i / 12),
        duration_time: String(1 / 12),
    })),
};
function respondVideo(
    formatTags: Record<string, string>,
    streamTags: Record<string, string> = {},
    extra: object[] = []
) {
    vi.mocked($)
        .mockResolvedValueOnce({
            stdout: JSON.stringify({
                format: { ...format, tags: formatTags },
                streams: [{ ...stream, tags: streamTags }, ...extra],
            }),
        })
        .mockResolvedValueOnce({ stdout: JSON.stringify(decoded) });
}

const metadataCases: { formatTags: Record<string, string>; streamTags: Record<string, string>; expected: boolean }[] = [
    {
        formatTags: { major_brand: 'isom', minor_version: '512', compatible_brands: 'isom', encoder: 'technical' },
        streamTags: {},
        expected: false,
    },
    {
        formatTags: {},
        streamTags: { language: 'und', handler_name: 'video', vendor_id: 'x', encoder: 'technical' },
        expected: false,
    },
    { formatTags: { title: 'remove' }, streamTags: {}, expected: true },
    { formatTags: {}, streamTags: { title: 'remove' }, expected: true },
    { formatTags: { ENCODER: 'mkv' }, streamTags: {}, expected: true },
];
it.each(metadataCases)(
    'evaluates actual format and stream tags on the probe boundary %#',
    async ({ formatTags, streamTags, expected }) => {
        respondVideo(formatTags, streamTags);
        expect((await probeVideo('/tmp/clip.mp4')).hasMetadata).toBe(expected);
    }
);

it('classifies excluded streams and retains decoded temporal evidence', async () => {
    respondVideo({}, {}, [
        { index: 1, codec_type: 'subtitle', codec_name: 'hdmv_pgs_subtitle' },
        { index: 2, codec_type: 'data', codec_name: 'bin_data' },
        { index: 3, codec_type: 'attachment', codec_name: 'ttf' },
    ]);
    const result = await probeVideo('/tmp/clip.mkv');
    expect(result.subtitles.map(sub => sub.kind)).toEqual(['binary', 'data', 'attachment']);
    expect(result.video?.timing).toMatchObject({ start: 0, end: 0.5, frameCount: 6, constantFrameRate: true });
});

it.each([
    { ...decoded, frames: undefined },
    { ...decoded, streams: [{ nb_read_frames: '7' }] },
    { ...decoded, frames: [{ best_effort_timestamp_time: '0' }] },
    { streams: [{ nb_read_frames: '1' }], frames: [{ best_effort_timestamp_time: 'NaN', duration_time: '1' }] },
])('rejects missing or implausible temporal evidence %#', async evidence => {
    vi.mocked($)
        .mockResolvedValueOnce({ stdout: JSON.stringify({ format, streams: [stream] }) })
        .mockResolvedValueOnce({ stdout: JSON.stringify(evidence) });
    await expect(probeVideo('/tmp/clip.mp4')).rejects.toThrow(/video.*timing evidence/);
});

it.each([[], [{}], [{ image: { format: 'PNG', geometry: { width: 0, height: 10 } } }]].map(response => ({ response })))(
    'rejects empty or invalid image responses %#',
    async ({ response }) => {
        vi.mocked($).mockResolvedValue({ stdout: JSON.stringify(response) });
        await expect(probeImage('/tmp/image.png')).rejects.toThrow();
    }
);

it('rejects undecodable video bodies even when their container headers are valid', async () => {
    vi.mocked($)
        .mockResolvedValueOnce({ stdout: JSON.stringify({ format, streams: [stream] }) })
        .mockResolvedValueOnce({
            stdout: JSON.stringify({ streams: [{ nb_read_frames: '1' }] }),
            stderr: 'Invalid NAL unit',
        });
    await expect(probeVideo('/tmp/corrupt.mp4')).rejects.toThrow('cannot be read completely');
});
