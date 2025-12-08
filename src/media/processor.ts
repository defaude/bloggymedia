import { access, cp, constants as fsConstants, mkdir, rename } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { $ } from 'zx';

import { transcodeVideo } from '../adapters/ffmpeg.js';
import { resizeImage } from '../adapters/mogrify.js';
import { classifyMediaType, IMAGE_MAX_SIZE, ORIGINALS_DIR, VIDEO_MAX_HEIGHT } from './constants.js';

export type MediaFile = {
    path: string;
    type: 'image' | 'video' | 'other';
};

export type FileResult = {
    fileName: string;
    status: 'processed' | 'skipped' | 'failed';
    reason?: string;
};

export type ProcessSummary = {
    processed: number;
    skipped: number;
    failed: number;
    files: FileResult[];
};

export type ProgressUpdate = {
    currentFile: string;
    status: FileResult['status'];
    processed: number;
    skipped: number;
    failed: number;
    remaining: number;
    reason?: string;
};

export type ProcessFilesOptions = {
    workingDir: string;
    filePaths: string[];
    onProgress?: (update: ProgressUpdate) => void;
    toolCheck?: () => Promise<string[]>;
};

export class MissingToolsError extends Error {
    constructor(public missingTools: string[]) {
        super(`Missing required tools: ${missingTools.join(', ')}`);
        this.name = 'MissingToolsError';
    }
}

async function checkTool(binary: string): Promise<boolean> {
    const result = await $`command -v ${binary}`.nothrow();
    return result.exitCode === 0;
}

export async function detectMissingTools(): Promise<string[]> {
    const required = ['mogrify', 'ffmpeg'];
    const missing: string[] = [];

    for (const tool of required) {
        const available = await checkTool(tool);
        if (!available) {
            missing.push(tool);
        }
    }

    return missing;
}

async function ensureOriginalsDir(workingDir: string) {
    const originalsDir = join(workingDir, ORIGINALS_DIR);
    await mkdir(originalsDir, { recursive: true });
    return originalsDir;
}

async function backupExists(originalsDir: string, fileName: string): Promise<boolean> {
    const backupPath = join(originalsDir, fileName);
    try {
        await access(backupPath, fsConstants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function createBackupIfMissing(originalsDir: string, sourcePath: string, fileName: string) {
    const backupPath = join(originalsDir, fileName);
    await cp(sourcePath, backupPath, { errorOnExist: true, force: false });
}

async function processImage(filePath: string) {
    await resizeImage({ input: filePath, maxSize: IMAGE_MAX_SIZE });
}

async function processVideo(filePath: string) {
    const directory = dirname(filePath);
    const fileName = basename(filePath);
    const tempOutput = join(directory, `${fileName}.tmp`);

    await transcodeVideo({
        input: filePath,
        output: tempOutput,
        maxHeight: VIDEO_MAX_HEIGHT,
    });

    await rename(tempOutput, filePath);
}

export async function processFiles({
    workingDir,
    filePaths,
    onProgress,
    toolCheck,
}: ProcessFilesOptions): Promise<ProcessSummary> {
    const missing = await (toolCheck ?? detectMissingTools)();
    if (missing.length) {
        throw new MissingToolsError(missing);
    }

    const totals: ProcessSummary = { processed: 0, skipped: 0, failed: 0, files: [] };
    const originalsDir = await ensureOriginalsDir(workingDir);

    for (let index = 0; index < filePaths.length; index += 1) {
        const filePath = filePaths[index];
        const fileName = basename(filePath);
        const mediaType = classifyMediaType(filePath);
        const remaining = filePaths.length - index - 1;

        if (mediaType === 'other') {
            totals.skipped += 1;
            totals.files.push({ fileName, status: 'skipped', reason: 'unsupported' });
            onProgress?.({
                currentFile: fileName,
                status: 'skipped',
                processed: totals.processed,
                skipped: totals.skipped,
                failed: totals.failed,
                remaining,
                reason: 'unsupported',
            });
            continue;
        }

        if (await backupExists(originalsDir, fileName)) {
            totals.skipped += 1;
            totals.files.push({ fileName, status: 'skipped', reason: 'backup-exists' });
            onProgress?.({
                currentFile: fileName,
                status: 'skipped',
                processed: totals.processed,
                skipped: totals.skipped,
                failed: totals.failed,
                remaining,
                reason: 'backup-exists',
            });
            continue;
        }

        try {
            await createBackupIfMissing(originalsDir, filePath, fileName);

            if (mediaType === 'image') {
                await processImage(filePath);
            } else if (mediaType === 'video') {
                await processVideo(filePath);
            }

            totals.processed += 1;
            totals.files.push({ fileName, status: 'processed' });
            onProgress?.({
                currentFile: fileName,
                status: 'processed',
                processed: totals.processed,
                skipped: totals.skipped,
                failed: totals.failed,
                remaining,
            });
        } catch (error: unknown) {
            const reason = error instanceof Error ? error.message : 'Unknown error';
            totals.failed += 1;
            totals.files.push({ fileName, status: 'failed', reason });
            onProgress?.({
                currentFile: fileName,
                status: 'failed',
                processed: totals.processed,
                skipped: totals.skipped,
                failed: totals.failed,
                remaining,
                reason,
            });
        }
    }

    return totals;
}
