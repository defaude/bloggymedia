#!/usr/bin/env node

import { cli } from './cli.js';

const [workingDir] = process.argv.slice(2);
await cli({ workingDir });
