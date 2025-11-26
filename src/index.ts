#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import { runCli } from './cli.js';

export async function main(argv: string[] = process.argv) {
    const [input] = argv.slice(2);
    await runCli({ input });
}

const isDirectRun = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
