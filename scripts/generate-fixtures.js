import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { $ } from 'zx';

const fixturesDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
const fixturesListPath = join(fixturesDir, 'fixtures.json');
const videoDurationSeconds = 3;

const fixtures = JSON.parse(await readFile(fixturesListPath, 'utf8'));

if (!Array.isArray(fixtures)) {
    throw new Error('fixtures.json must be an array of filenames');
}

await cleanFixturesDirectory();

for (const fixtureName of fixtures) {
    const imageParams = parseImageFixture(fixtureName);
    if (imageParams) {
        await generateImage(imageParams);
        continue;
    }

    const videoParams = parseVideoFixture(fixtureName);
    if (videoParams) {
        await generateVideo(videoParams);
        continue;
    }

    throw new Error(`Unsupported fixture filename format: ${fixtureName}`);
}

async function cleanFixturesDirectory() {
    const entries = await readdir(fixturesDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name === 'fixtures.json') {
            continue;
        }

        await rm(join(fixturesDir, entry.name), { recursive: true, force: true });
    }
}

function parseImageFixture(filename) {
    const match = /^img-(\d+)x(\d+)\.(png|jpg)$/.exec(filename);
    if (!match) {
        return null;
    }

    const [, width, height, format] = match;
    return { filename, width: Number(width), height: Number(height), format };
}

function parseVideoFixture(filename) {
    const match = /^vid-(\d+)fps-(\d+)x(\d+)-(h264|h265)-(audio|noaudio)\.mp4$/.exec(filename);
    if (!match) {
        return null;
    }

    const [, fps, width, height, codec, audio] = match;
    return {
        filename,
        fps: Number(fps),
        width: Number(width),
        height: Number(height),
        codec,
        hasAudio: audio === 'audio',
    };
}

async function generateImage({ filename, width, height, format }) {
    const target = join(fixturesDir, filename);
    const qualityArgs = format === 'jpg' ? ['-q:v', '2'] : [];
    const input = `testsrc=size=${width}x${height}:rate=1`;

    await $`ffmpeg -v error -f lavfi -i ${input} -frames:v 1 ${qualityArgs} ${target}`;
}

async function generateVideo({ filename, width, height, fps, codec, hasAudio }) {
    const target = join(fixturesDir, filename);
    const videoInput = `testsrc=size=${width}x${height}:rate=${fps}`;
    const videoCodec = codec === 'h264' ? 'libx264' : 'libx265';
    const videoTagArgs = codec === 'h265' ? ['-tag:v', 'hvc1'] : [];
    const audioInputs = hasAudio ? ['-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=48000'] : [];
    const audioCodecArgs = hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an'];

    await $`ffmpeg -v error -f lavfi -i ${videoInput} ${audioInputs} -t ${videoDurationSeconds} -c:v ${videoCodec} ${videoTagArgs} -pix_fmt yuv420p -movflags +faststart ${audioCodecArgs} ${target}`;
}
