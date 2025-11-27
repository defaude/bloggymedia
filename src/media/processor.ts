import { cp, mkdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import { resizeImage } from '../adapters/mogrify.js';

type MediaType = 'image' | 'video' | 'other';

export type MediaFile = {
    path: string;
    type: MediaType;
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi']);

export function classifyFile(filePath: string): MediaType {
    const extension = extname(filePath).toLowerCase();

    if (IMAGE_EXTENSIONS.has(extension)) {
        return 'image';
    }

    if (VIDEO_EXTENSIONS.has(extension)) {
        return 'video';
    }

    return 'other';
}

type ProcessFilesOptions = {
    workingDir: string;
    filePaths: string[];
};

export async function processFiles({ workingDir, filePaths }: ProcessFilesOptions) {
    for (const filePath of filePaths) {
        const mediaFile: MediaFile = { path: filePath, type: classifyFile(filePath) };

        switch (mediaFile.type) {
            case 'image':
                await handleImage(mediaFile, workingDir);
                break;
            case 'video':
                await handleVideo(mediaFile);
                break;
            default:
                await handleOther(mediaFile);
                break;
        }
    }
}

export async function handleImage(file: MediaFile, workingDir: string) {
    const originalsDir = join(workingDir, '.originals');
    await mkdir(originalsDir, { recursive: true });

    const backupPath = join(originalsDir, basename(file.path));

    try {
        await cp(file.path, backupPath, { errorOnExist: true, force: false });
    } catch (error: unknown) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code !== 'EEXIST' && err?.code !== 'ERR_FS_CP_EEXIST') {
            throw error;
        }
    }

    await resizeImage({ input: file.path, maxSize: '1200x1200' });
}

export async function handleVideo(file: MediaFile) {
    console.log(`Video handler placeholder for ${basename(file.path)}`);
}

export async function handleOther(_file: MediaFile) {
    // intentionally no-op
}
