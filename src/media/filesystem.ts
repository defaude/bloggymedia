import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function findMediaFiles(basePath: string) {
    const entries = await readdir(basePath, { withFileTypes: true });
    return entries.filter(entry => entry.isFile()).map(entry => join(basePath, entry.name));
}
