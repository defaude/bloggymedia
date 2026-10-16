import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../src/adapters/image.js', () => ({ probeImage: vi.fn() }));

import { type ImageFrame, probeImage } from '../../src/adapters/image.js';
import { inspectImage, validateImage } from '../../src/media/image.js';

const frame: ImageFrame = {
    format: 'GIF',
    depth: 8,
    geometry: { width: 64, height: 48, x: 0, y: 0 },
    pageGeometry: { width: 64, height: 48, x: 0, y: 0 },
    delay: '10x100',
    iterations: 3,
    dispose: 'None',
};
beforeEach(() => {
    vi.resetAllMocks();
});

it('checks later frames and animation canvases as well as metadata profiles', async () => {
    vi.mocked(probeImage).mockResolvedValue([
        frame,
        {
            ...frame,
            pageGeometry: { ...frame.pageGeometry, width: 1600 },
            profiles: { exif: {} },
        },
    ]);
    expect((await inspectImage('animation.gif')).reasons).toEqual(['resolution', 'metadata']);
});

it('distinguishes technical decoder properties from removable comments and color metadata', async () => {
    vi.mocked(probeImage).mockResolvedValue([
        {
            ...frame,
            properties: {
                'date:modify': 'now',
                signature: 'abc',
                'png:IHDR.width,height': '64,48',
                'webp:mux-blend': 'AtopPreviousAlphaBlend',
            },
        },
    ]);
    expect((await inspectImage('image.png')).reasons).toEqual([]);
    vi.mocked(probeImage).mockResolvedValue([{ ...frame, properties: { comment: 'remove', 'png:gAMA': 'found' } }]);
    expect((await inspectImage('image.png')).reasons).toEqual(['metadata']);
});

it.each([
    { frames: [frame], reasons: ['metadata'] },
    { frames: [], reasons: [] },
    { frames: [{ ...frame, format: 'JPEG' }], reasons: [] },
    { frames: [{ ...frame, delay: '20x100' }], reasons: [] },
    { frames: [{ ...frame, iterations: 1 }], reasons: [] },
    { frames: [{ ...frame, geometry: { ...frame.geometry, width: 32 } }], reasons: [] },
    { frames: [{ ...frame, pageGeometry: { ...frame.pageGeometry, x: 10 } }], reasons: [] },
])('rejects non-compliant or semantically incomplete image output %#', output => {
    expect(() => validateImage({ frames: [frame], reasons: ['metadata'] }, output)).toThrow();
});

it('rejects transparency loss including semitransparent input', () => {
    const source = { frames: [{ ...frame, channelStatistics: { alpha: { min: 128 } } }], reasons: ['metadata'] };
    expect(() => validateImage(source, { frames: [frame], reasons: [] })).toThrow('transparency');
});

it('rejects an unsupported actual format regardless of filename', async () => {
    vi.mocked(probeImage).mockResolvedValue([{ ...frame, format: 'TIFF' }]);
    await expect(inspectImage('fake.jpg')).rejects.toThrow('actual image format');
});
