import { copyFile, lstat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import { transcodeVideo } from '../adapters/ffmpeg.js';
import { resizeImage } from '../adapters/mogrify.js';
import { detectMissingTools } from '../adapters/tools.js';
import { copiedStreamPackets } from '../adapters/validate-video.js';
import { classifyMediaType, IMAGE_MAX_SIZE } from './constants.js';
import { inspectImage, validateImage } from './image.js';
import { inspectVideo } from './inspect.js';
import { replaceMedia } from './transaction.js';
import { validateVideo } from './video-validation.js';

export { detectMissingTools } from '../adapters/tools.js';

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
    signal?: AbortSignal;
};

export class MissingToolsError extends Error {
    constructor(public missingTools: string[]) {
        super(`Missing required tools: ${missingTools.join(', ')}`);
        this.name = 'MissingToolsError';
    }
}

async function processFile(filePath: string, workingDir: string, signal?: AbortSignal): Promise<FileResult> {
    const fileName = basename(filePath);
    let phase = 'inspect';
    try {
        signal?.throwIfAborted();
        if (dirname(resolve(filePath)) !== resolve(workingDir) || !(await lstat(filePath)).isFile()) {
            throw new Error('Input must be a regular file directly in the selected directory');
        }
        const mediaType = classifyMediaType(filePath);
        if (mediaType === 'other') {
            return { fileName, status: 'skipped', reason: 'unsupported' };
        }
        if (mediaType === 'image') {
            const source = await inspectImage(filePath);
            if (!source.reasons.length) {
                return { fileName, status: 'skipped', reason: 'compliant' };
            }
            phase = 'transaction';
            await replaceMedia(
                filePath,
                async temporary => {
                    await copyFile(filePath, temporary);
                    await resizeImage({ input: temporary, maxSize: IMAGE_MAX_SIZE });
                },
                async temporary => validateImage(source, await inspectImage(temporary)),
                signal
            );
            return { fileName, status: 'processed', reason: source.reasons.join(', ') };
        }
        const source = await inspectVideo(filePath);
        const reasons = source.decision.reasons;
        if (source.decision.classification === 'skip') {
            return { fileName, status: 'skipped', reason: 'compliant' };
        }
        const plan = source.decision.plan;
        const packets = await copiedStreamPackets(filePath, [...plan.audioIndices, ...plan.keepSubtitleIndices]);
        phase = 'transaction';
        await replaceMedia(
            filePath,
            async temporary => {
                await transcodeVideo({
                    input: filePath,
                    output: temporary,
                    targetWidth: plan.targetWidth,
                    targetHeight: plan.targetHeight,
                    targetFrameRate: plan.targetFrameRate,
                    audioIndices: plan.audioIndices,
                    subtitleIndices: plan.keepSubtitleIndices,
                });
            },
            async temporary => {
                const output = await inspectVideo(temporary);
                validateVideo(source, output);
                const outputPackets = await copiedStreamPackets(temporary, [
                    ...output.probe.audio.map(stream => stream.index),
                    ...output.probe.subtitles.map(stream => stream.index),
                ]);
                if (JSON.stringify(packets) !== JSON.stringify(outputPackets)) {
                    throw new Error('Copied audio or subtitle packet contents changed');
                }
            },
            signal
        );
        return { fileName, status: 'processed', reason: reasons.join(', ') };
    } catch (error) {
        return {
            fileName,
            status: 'failed',
            reason: `${phase}: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

export async function processFiles({ workingDir, filePaths, onProgress, toolCheck, signal }: ProcessFilesOptions) {
    const missing = await (toolCheck ?? detectMissingTools)();
    if (missing.length) {
        throw new MissingToolsError(missing);
    }
    const totals: ProcessSummary = { processed: 0, skipped: 0, failed: 0, files: [] };
    const inputs = [...filePaths];
    for (const [index, filePath] of inputs.entries()) {
        const result = await processFile(filePath, workingDir, signal);
        totals[result.status] += 1;
        totals.files.push(result);
        // Reporting is outside the transaction and cannot turn a committed file into a failure.
        onProgress?.({
            currentFile: result.fileName,
            status: result.status,
            reason: result.reason,
            processed: totals.processed,
            skipped: totals.skipped,
            failed: totals.failed,
            remaining: inputs.length - index - 1,
        });
    }
    return totals;
}
