import { transcodeVideo } from '../adapters/ffmpeg.js';
import { resizeImage } from '../adapters/mogrify.js';
import type { CliOptions } from '../cli.js';

type MediaFile = {
    path: string;
    type: 'image' | 'video';
};

export async function processMedia(_options: CliOptions, _files: MediaFile[]) {
    // Skeleton function to wire adapters; implementation will classify files and call processors.
    // Placeholder to anchor upcoming logic.
    await Promise.resolve();
}

export async function handleImage(file: MediaFile) {
    await resizeImage({ input: file.path, maxSize: '1200x1200' });
}

export async function handleVideo(file: MediaFile) {
    await transcodeVideo({ input: file.path, output: file.path, maxResolution: '1280:720' });
}
