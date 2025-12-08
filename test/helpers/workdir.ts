import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

export async function createWorkingDirFromFixtures(fixtureNames: string[]) {
    const workdir = await mkdtemp(join(tmpdir(), 'bloggymedia-workdir-'));
    const fixtureRoot = join(process.cwd(), 'fixtures');

    await Promise.all(
        fixtureNames.map(async fixture => {
            const source = join(fixtureRoot, fixture);
            const destination = join(workdir, basename(fixture));
            await cp(source, destination);
        })
    );

    return workdir;
}
