import { $ } from 'zx';

export async function detectMissingTools(): Promise<string[]> {
    const missing: string[] = [];
    for (const tool of ['mogrify', 'ffmpeg', 'ffprobe', 'magick']) {
        const result = await $`command -v ${tool}`.nothrow();
        if (result.exitCode !== 0) {
            missing.push(tool);
        }
    }
    return missing;
}
