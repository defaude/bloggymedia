import { describe, expect, it } from 'vitest';

import { runCli } from '../src/cli.js';

describe('runCli', () => {
    it('throws when input is missing', async () => {
        await expect(runCli({ input: '' })).rejects.toThrowError('Input path is required');
    });
});
