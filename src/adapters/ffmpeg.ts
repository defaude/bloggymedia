import { $ } from 'zx';

export type FfmpegOptions = {
    input: string;
    output: string;
    maxHeight: number;
};

async function hasAudioStream(input: string): Promise<boolean> {
    const probe = await $`ffprobe -v error -select_streams a:0 -show_entries stream=index -of csv=p=0 ${input}`;
    return (probe.stdout ?? '').trim().length > 0;
}

export async function transcodeVideo({ input, output, maxHeight }: FfmpegOptions) {
    const audioArgs = (await hasAudioStream(input)) ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an'];

    await $`ffmpeg -hide_banner -loglevel warning -y -i ${input} -vf scale='-2:min(ih\\,${maxHeight})' -c:v libx264 -crf 23 -preset medium ${audioArgs} -movflags +faststart -map_metadata -1 ${output}`;
}
