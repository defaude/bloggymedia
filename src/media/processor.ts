import { access, cp, constants as fsConstants, mkdir, rename, rm } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';

import { transcodeVideo } from '../adapters/ffmpeg.js';
import { resizeImage } from '../adapters/mogrify.js';
import { classifyMediaType, IMAGE_MAX_SIZE, ORIGINALS_DIR, VIDEO_MAX_HEIGHT, VIDEO_MAX_WIDTH } from './constants.js';
import { inspectVideo } from './inspect.js';
import type { VideoInspectionResult } from './types.js';

export type MediaFile = {
    path: string;
    type: 'image' | 'video' | 'other';
};

export type FileResult = {
    fileName: string;
    status: 'processed' | 'skipped' | 'failed';
    reason?: string;
    reasons?: string[];
    backupPath?: string;
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
    const { $ } = await import('zx');
    const result = await $`command -v ${binary}`.nothrow();
    return result.exitCode === 0;
}

export async function detectMissingTools(): Promise<string[]> {
    const required = ['mogrify', 'ffmpeg', 'ffprobe'];
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

async function processVideo(filePath: string, inspection: VideoInspectionResult) {
    const directory = dirname(filePath);
    const extension = extname(filePath) || '.mp4';
    const baseName = basename(filePath, extension);
    const tempOutput = join(directory, `${baseName}.tmp${extension}`);

    try {
        await transcodeVideo({
            input: filePath,
            output: tempOutput,
            targetWidth: inspection.decision.plan.targetWidth || VIDEO_MAX_WIDTH,
            targetHeight: inspection.decision.plan.targetHeight || VIDEO_MAX_HEIGHT,
            targetFrameRate: inspection.decision.plan.targetFrameRate,
            audioIndices: inspection.decision.plan.audioIndices,
            subtitleIndices: inspection.decision.plan.keepSubtitleIndices,
        });

        await rename(tempOutput, filePath);
    } catch (error) {
        await rm(tempOutput, { force: true }).catch(() => {});
        throw error;
    }
}

async function restoreFailedProcessing(originalsDir: string, destination: string, fileName: string) {
    const backupPath = join(originalsDir, fileName);
    try {
        await access(backupPath, fsConstants.F_OK);
    } catch {
        return;
    }

    await cp(backupPath, destination, { force: true });
    await rm(backupPath, { force: true });
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
    let originalsDir: string | null = null;

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

        try {
            if (mediaType === 'image') {
                if (!originalsDir) {
                    originalsDir = await ensureOriginalsDir(workingDir);
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

                await createBackupIfMissing(originalsDir, filePath, fileName);
                await processImage(filePath);

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
                continue;
            }

            // video path
            const inspection = await inspectVideo(filePath);
            const reasonText = inspection.decision.reasons.join(', ') || 'compliant';

            if (inspection.decision.classification === 'skip') {
                totals.skipped += 1;
                totals.files.push({
                    fileName,
                    status: 'skipped',
                    reason: reasonText,
                    reasons: inspection.decision.reasons,
                });
                onProgress?.({
                    currentFile: fileName,
                    status: 'skipped',
                    processed: totals.processed,
                    skipped: totals.skipped,
                    failed: totals.failed,
                    remaining,
                    reason: reasonText,
                });
                continue;
            }

            if (!originalsDir) {
                originalsDir = await ensureOriginalsDir(workingDir);
            }
            const backupAlready = await backupExists(originalsDir, fileName);
            if (!backupAlready) {
                await createBackupIfMissing(originalsDir, filePath, fileName);
            }

            await processVideo(filePath, inspection);

            totals.processed += 1;
            totals.files.push({
                fileName,
                status: 'processed',
                reason: reasonText,
                reasons: inspection.decision.reasons,
                backupPath: join(originalsDir, fileName),
            });
            onProgress?.({
                currentFile: fileName,
                status: 'processed',
                processed: totals.processed,
                skipped: totals.skipped,
                failed: totals.failed,
                remaining,
                reason: reasonText,
            });
        } catch (error: unknown) {
            let reason = error instanceof Error ? error.message : 'Unknown error';
            try {
                if (originalsDir) {
                    await restoreFailedProcessing(originalsDir, filePath, fileName);
                }
            } catch (restoreError) {
                const restoreReason = restoreError instanceof Error ? restoreError.message : 'Unknown restore error';
                reason = `${reason} (restore failed: ${restoreReason})`;
            }
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
