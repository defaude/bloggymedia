import { join } from 'node:path';

import fg from 'fast-glob';

export async function findMediaFiles(basePath: string) {
    // Collect images and videos under the given path; patterns will be refined with requirements.
    const patterns = ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.webp', '**/*.mp4', '**/*.mov', '**/*.avi'];
    return fg(patterns, {
        cwd: basePath,
        onlyFiles: true,
        suppressErrors: true,
    }).then(files => files.map(file => join(basePath, file)));
}
