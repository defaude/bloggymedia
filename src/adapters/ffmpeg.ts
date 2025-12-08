import { $ } from 'zx';

export type FfmpegOptions = {
    input: string;
    output: string;
    maxHeight: number;
};

export async function transcodeVideo({ input, output, maxHeight }: FfmpegOptions) {
    await $`ffmpeg -y -i ${input} -vf scale='-2:min(ih\\,${maxHeight})' -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -movflags +faststart -map_metadata -1 ${output}`;
}
