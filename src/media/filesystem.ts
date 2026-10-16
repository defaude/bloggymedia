import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { isMediaFile } from './constants.js';

export async function findMediaFiles(basePath: string): Promise<string[]> {
    const entries = await readdir(basePath, { withFileTypes: true });
    return entries
        .filter(entry => entry.isFile() && isMediaFile(entry.name))
        .map(entry => join(resolve(basePath), entry.name))
        .sort();
}
