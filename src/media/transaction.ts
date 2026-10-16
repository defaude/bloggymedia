import { randomUUID } from 'node:crypto';
import { chmod, lstat, open, rename, rm, utimes } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';

export async function replaceMedia(
    source: string,
    write: (temporary: string) => Promise<void>,
    validate: (temporary: string) => Promise<void>,
    signal?: AbortSignal
) {
    let phase = 'prepare';
    let temporary: string | undefined;
    try {
        signal?.throwIfAborted();
        const original = await lstat(source);
        if (!original.isFile()) {
            throw new Error('Source must be a regular file');
        }
        // Exclusive creation, same filesystem and extension; retry only name collisions.
        for (;;) {
            const candidate = join(dirname(source), `.bloggymedia-${randomUUID()}${extname(source)}`);
            try {
                const handle = await open(candidate, 'wx');
                temporary = candidate;
                await handle.close();
                break;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                    throw error;
                }
            }
        }
        phase = 'process';
        await write(temporary);
        signal?.throwIfAborted();
        phase = 'validate';
        const output = await lstat(temporary);
        if (!output.isFile() || output.size === 0) {
            throw new Error('Output is missing, empty or not a regular file');
        }
        await validate(temporary);
        signal?.throwIfAborted();
        phase = 'mtime';
        await chmod(temporary, original.mode);
        // Numeric seconds preserve sub-millisecond precision available in Node's stat.
        await utimes(temporary, original.atimeMs / 1000, original.mtimeMs / 1000);
        phase = 'rename';
        const current = await lstat(source);
        if (current.ino !== original.ino || current.size !== original.size || current.mtimeMs !== original.mtimeMs) {
            throw new Error('Source changed during processing');
        }
        signal?.throwIfAborted();
        await rename(temporary, source);
        temporary = undefined;
    } catch (error) {
        let message = `${phase}: ${error instanceof Error ? error.message : String(error)}`;
        if (temporary) {
            await rm(temporary, { force: true }).catch(cleanup => {
                message += `; cleanup failed: ${String(cleanup)}`;
            });
        }
        throw new Error(message, { cause: error });
    }
}
