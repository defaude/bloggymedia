import { stat } from 'node:fs/promises';

import { ORIGINALS_DIR } from './media/constants.js';
import { findMediaFiles } from './media/filesystem.js';
import { MissingToolsError, type ProgressUpdate, processFiles } from './media/processor.js';

export type CliOptions = {
    workingDir?: string;
};

export async function cli({ workingDir = process.cwd() }: CliOptions) {
    console.log('Starting bloggymedia...'); // immediate greeting for SC-001

    const info = await stat(workingDir).catch(() => null);

    if (!info) {
        throw new Error(`Working directory does not exist: ${workingDir}`);
    }

    if (!info.isDirectory()) {
        throw new Error(`Provided workingDir is not a directory: ${workingDir}`);
    }

    const filePaths = await findMediaFiles(workingDir);

    if (filePaths.length === 0) {
        console.log('No media files found to optimize. Exiting without changes.');
        return;
    }

    console.log(`Found ${filePaths.length} media file(s). Backups will be stored in ${ORIGINALS_DIR}/`);

    const logProgress = (update: ProgressUpdate) => {
        const { currentFile, status, processed, skipped, failed, remaining, reason } = update;
        const reasonText = reason ? ` (${reason})` : '';
        console.log(
            `[${status}] ${currentFile} | processed: ${processed}, skipped: ${skipped}, failed: ${failed}, remaining: ${remaining}${reasonText}`
        );
    };

    try {
        const summary = await processFiles({ workingDir, filePaths, onProgress: logProgress });

        console.log('--- Summary ---');
        console.log(`Processed: ${summary.processed}`);
        console.log(`Skipped:   ${summary.skipped}`);
        console.log(`Failed:    ${summary.failed}`);

        const processedFiles = summary.files.filter(file => file.status === 'processed').map(file => file.fileName);
        const skippedFiles = summary.files.filter(file => file.status === 'skipped').map(file => file.fileName);
        const failedFiles = summary.files.filter(file => file.status === 'failed').map(file => file.fileName);

        if (processedFiles.length > 0) {
            console.log(`Processed files: ${processedFiles.join(', ')}`);
        }
        if (skippedFiles.length > 0) {
            console.log(`Skipped files: ${skippedFiles.join(', ')}`);
        }
        if (failedFiles.length > 0) {
            console.log(`Failed files: ${failedFiles.join(', ')}`);
        }
    } catch (error: unknown) {
        if (error instanceof MissingToolsError) {
            console.error(`Missing required tools: ${error.missingTools.join(', ')}`);
        } else if (error instanceof Error) {
            console.error(error.message);
        }
        throw error;
    }
}
