import { createWriteStream } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const fixturesPath = fileURLToPath(new URL('../fixtures/', import.meta.url));

const downloads = [
    'https://thetestdata.com/assets/video/mp4/highquality/4K_4_Thetestdata.mp4',
    'https://thetestdata.com/assets/video/mp4/720/5MB_720P_THETESTDATA.COM_mp4.mp4',
    'https://thetestdata.com/assets/video/mp4/480/5MB_480P_THETESTDATA.COM_mp4.mp4',
];

async function fileExists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function downloadToFixtures(url) {
    const filename = basename(url);
    const targetPath = join(fixturesPath, filename);

    if (await fileExists(targetPath)) {
        console.log(`Skipping existing ${filename}`);
        return;
    }

    await mkdir(fixturesPath, { recursive: true });

    const response = await fetch(url);

    if (!response.ok || response.body === null) {
        throw new Error(`Failed to download ${url} (status ${response.status})`);
    }

    await pipeline(Readable.fromWeb(response.body), createWriteStream(targetPath));
    console.log(`Downloaded ${filename}`);
}

export async function main() {
    for (const url of downloads) {
        await downloadToFixtures(url);
    }
}

const isDirectRun = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
