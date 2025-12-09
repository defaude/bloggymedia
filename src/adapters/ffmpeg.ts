import { $ } from 'zx';

export type FfmpegOptions = {
    input: string;
    output: string;
    targetWidth: number;
    targetHeight: number;
    targetFrameRate: number;
    audioIndices: number[];
    subtitleIndices: number[];
};

function buildMapArgs(audioIndices: number[], subtitleIndices: number[]) {
    const args = ['-map', '0:v:0'];
    for (const index of audioIndices) {
        args.push('-map', `0:${index}`);
    }
    for (const index of subtitleIndices) {
        args.push('-map', `0:${index}`);
    }
    return args;
}

function buildAudioArgs(audioIndices: number[]) {
    if (audioIndices.length === 0) {
        return ['-an'];
    }
    return ['-c:a', 'copy'];
}

function buildSubtitleArgs(subtitleIndices: number[]) {
    if (subtitleIndices.length === 0) {
        return ['-sn'];
    }
    return ['-c:s', 'copy'];
}

export async function transcodeVideo({
    input,
    output,
    targetWidth,
    targetHeight,
    targetFrameRate,
    audioIndices,
    subtitleIndices,
}: FfmpegOptions) {
    const mapArgs = buildMapArgs(audioIndices, subtitleIndices);
    const audioArgs = buildAudioArgs(audioIndices);
    const subtitleArgs = buildSubtitleArgs(subtitleIndices);

    await $`ffmpeg -hide_banner -loglevel warning -y -i ${input} \
-vf scale=${targetWidth}:${targetHeight} \
-r ${targetFrameRate} \
-c:v libx264 -crf 23 -preset medium \
${audioArgs} \
${subtitleArgs} \
-movflags +faststart \
-map_metadata -1 -map_metadata:s:v -1 -map_metadata:s:a -1 -map_metadata:s:s -1 -map_chapters -1 \
${mapArgs} \
${output}`;
}
