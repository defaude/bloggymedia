export const ORIGINALS_DIR = '.originals';

export const IMAGE_MAX_SIZE = '1200x1200';
export const VIDEO_MAX_WIDTH = 1280;
export const VIDEO_MAX_HEIGHT = 720;
export const VIDEO_MAX_PORTRAIT_WIDTH = 720;
export const VIDEO_MAX_PORTRAIT_HEIGHT = 1280;
export const VIDEO_MAX_FRAMERATE = 24;
export const VIDEO_CODEC = 'libx264';
export const VIDEO_TARGET_CODEC_NAME = 'h264';

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.mkv', '.avi']);

export const SUBTITLE_TEXT_CODECS = new Set(['srt', 'subrip', 'ass', 'ssa', 'webvtt', 'vtt', 'mov_text', 'text']);

export type MediaType = 'image' | 'video' | 'other';

export function classifyMediaType(filePath: string): MediaType {
    const normalized = filePath.toLowerCase();

    for (const ext of IMAGE_EXTENSIONS) {
        if (normalized.endsWith(ext)) {
            return 'image';
        }
    }

    for (const ext of VIDEO_EXTENSIONS) {
        if (normalized.endsWith(ext)) {
            return 'video';
        }
    }

    return 'other';
}

export function isMediaFile(filePath: string): boolean {
    return classifyMediaType(filePath) !== 'other';
}
