import { $ } from 'zx';

export type ImageFrame = {
    format: string;
    depth: number;
    geometry: { width: number; height: number; x: number; y: number };
    pageGeometry: { width: number; height: number; x: number; y: number };
    delay?: string;
    iterations?: number;
    dispose?: string;
    channelStatistics?: { alpha?: { min: number } };
    properties?: Record<string, string>;
    profiles?: Record<string, unknown>;
};

// JSON reads/decodes every frame; it does not write or recompress the input.
export async function probeImage(filePath: string): Promise<ImageFrame[]> {
    const { stdout } = await $`magick ${filePath} json:-`;
    const parsed = JSON.parse(stdout) as { image: ImageFrame }[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('No image frames found');
    }
    return parsed.map(({ image }) => {
        if (
            !image?.format ||
            ![
                image.geometry?.width,
                image.geometry?.height,
                image.pageGeometry?.width,
                image.pageGeometry?.height,
            ].every(value => Number.isInteger(value) && value > 0)
        ) {
            throw new Error('Invalid image geometry or format');
        }
        return image;
    });
}
