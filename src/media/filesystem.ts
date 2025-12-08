import { access } from 'node:fs/promises';
import { basename, join } from 'node:path';

import fg from 'fast-glob';

import { isMediaFile, ORIGINALS_DIR } from './constants.js';

async function backupExists(basePath: string, fileName: string): Promise<boolean> {
    const backupPath = join(basePath, ORIGINALS_DIR, fileName);
    try {
        await access(backupPath);
        return true;
    } catch {
        return false;
    }
}

export async function findMediaFiles(basePath: string) {
    const files = await fg('*', {
        cwd: basePath,
        onlyFiles: true,
        deep: 0,
        absolute: true,
    });

    const mediaFiles = [];

    for (const fullPath of files) {
        const fileName = basename(fullPath);

        if (!isMediaFile(fullPath)) {
            continue;
        }

        if (await backupExists(basePath, fileName)) {
            continue;
        }

        mediaFiles.push(fullPath);
    }

    return mediaFiles;
}
