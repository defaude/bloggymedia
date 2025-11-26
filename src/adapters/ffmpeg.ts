import { $ } from 'zx';

export type FfmpegOptions = {
    input: string;
    output: string;
    maxResolution: string;
};

export async function transcodeVideo({ input, output, maxResolution }: FfmpegOptions) {
    // Wraps ffmpeg invocation; flags will be finalized once processing logic is in place.
    await $`ffmpeg -i ${input} -vf scale=${maxResolution} ${output}`;
}
