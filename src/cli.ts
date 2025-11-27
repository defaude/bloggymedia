import { stat } from 'node:fs/promises';

import { findMediaFiles } from './media/filesystem.js';
import { processFiles } from './media/processor.js';

export type CliOptions = {
    workingDir?: string;
};

export async function cli({ workingDir = process.cwd() }: CliOptions) {
    const info = await stat(workingDir).catch(() => null);

    if (!info) {
        throw new Error(`Working directory does not exist: ${workingDir}`);
    }

    if (!info.isDirectory()) {
        throw new Error(`Provided workingDir is not a directory: ${workingDir}`);
    }

    const filePaths = await findMediaFiles(workingDir);
    await processFiles({ workingDir, filePaths });
}
