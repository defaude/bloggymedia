import { type ImageFrame, probeImage } from '../adapters/image.js';
import { IMAGE_EXTENSIONS, IMAGE_MAX_SIZE } from './constants.js';

const [MAX_WIDTH, MAX_HEIGHT] = IMAGE_MAX_SIZE.split('x').map(Number);

// Properties observed after -strip: decoder/file facts, not embedded user metadata.
const STRUCTURAL_PROPERTIES = new Set([
    'date:create',
    'date:modify',
    'date:timestamp',
    'signature',
    'png:IHDR.bit-depth-orig',
    'png:IHDR.bit_depth',
    'png:IHDR.color-type-orig',
    'png:IHDR.color_type',
    'png:IHDR.interlace_method',
    'png:IHDR.width,height',
    'png:PLTE.number_colors',
    'png:tRNS',
    'jpeg:colorspace',
    'jpeg:sampling-factor',
    'webp:mux-blend',
]);

export type ImageInspection = Awaited<ReturnType<typeof inspectImage>>;

export async function inspectImage(path: string) {
    const frames = await probeImage(path);
    const reasons: string[] = [];
    for (const frame of frames) {
        const extension = frame.format.toLowerCase() === 'jpeg' ? '.jpg' : `.${frame.format.toLowerCase()}`;
        if (!IMAGE_EXTENSIONS.has(extension)) {
            throw new Error(`Unsupported actual image format: ${frame.format}`);
        }
        if (
            frame.geometry.width > MAX_WIDTH ||
            frame.geometry.height > MAX_HEIGHT ||
            frame.pageGeometry.width > MAX_WIDTH ||
            frame.pageGeometry.height > MAX_HEIGHT
        ) {
            reasons.push('resolution');
        }
        if (
            Object.keys(frame.profiles ?? {}).length > 0 ||
            Object.keys(frame.properties ?? {}).some(key => !STRUCTURAL_PROPERTIES.has(key))
        ) {
            reasons.push('metadata');
        }
    }
    return { frames, reasons: [...new Set(reasons)] };
}

function transparent(frame: ImageFrame): boolean {
    const alpha = frame.channelStatistics?.alpha;
    return alpha !== undefined && alpha.min < 2 ** frame.depth - 1;
}

function seconds(frame: ImageFrame): number {
    const [ticks, rate = '100'] = (frame.delay ?? '0x100').split('x');
    const value = Number(ticks) / Number(rate);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error('Invalid animation delay');
    }
    return value;
}

export function validateImage(source: ImageInspection, output: ImageInspection) {
    if (output.reasons.length) {
        throw new Error(`Image output remains non-compliant: ${output.reasons.join(', ')}`);
    }
    if (source.frames.length !== output.frames.length) {
        throw new Error('Image output is non-compliant or lost animation frames');
    }
    source.frames.forEach((before, index) => {
        const after = output.frames[index];
        const scale = Math.min(MAX_WIDTH / before.pageGeometry.width, MAX_HEIGHT / before.pageGeometry.height, 1);
        if (
            source.frames.length > 1 &&
            scale < 1 &&
            (before.geometry.width !== before.pageGeometry.width ||
                before.geometry.height !== before.pageGeometry.height ||
                before.pageGeometry.x !== 0 ||
                before.pageGeometry.y !== 0)
        ) {
            // mogrify resizes small frame rectangles independently; their unscaled
            // pixels/offsets cannot represent a uniformly scaled animation canvas.
            throw new Error('Partial-frame animation resizing cannot be validated safely with the existing operation');
        }
        const expectedWidth = Math.max(1, Math.round(before.geometry.width * scale));
        const expectedHeight = Math.max(1, Math.round(before.geometry.height * scale));
        if (
            before.format !== after.format ||
            after.geometry.width !== expectedWidth ||
            after.geometry.height !== expectedHeight ||
            Math.abs(seconds(before) - seconds(after)) > 0.001 ||
            before.iterations !== after.iterations ||
            before.dispose !== after.dispose ||
            before.properties?.['webp:mux-blend'] !== after.properties?.['webp:mux-blend'] ||
            (transparent(before) && !transparent(after))
        ) {
            throw new Error('Image output does not preserve format, geometry, transparency or animation timing');
        }
        // Full-frame resizing must preserve the canvas and placement as well as frame dimensions.
        for (const key of ['width', 'height', 'x', 'y'] as const) {
            if (Math.abs(after.pageGeometry[key] - before.pageGeometry[key] * scale) > 1) {
                throw new Error('Image output does not preserve animation canvas');
            }
        }
    });
}
