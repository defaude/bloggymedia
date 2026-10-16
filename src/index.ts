#!/usr/bin/env node

import { $ } from 'zx';

import { cli } from './cli.js';

const args = process.argv.slice(2);
const controller = new AbortController();

const interrupt = () => {
    controller.abort(new Error('Processing interrupted'));
    process.exitCode = 130;
};

const terminate = () => {
    interrupt();
    process.exitCode = 143;
};

process.on('SIGINT', interrupt);
process.on('SIGTERM', terminate);

$.signal = controller.signal;

try {
    if (args.length > 1 || args.some(arg => arg.startsWith('-'))) {
        throw new Error('Usage: bloggymedia [directory] (at most one directory; flags are not supported)');
    }
    await cli({ workingDir: args[0], signal: controller.signal });
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = process.exitCode || 1;
} finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
}
