import { describe, expect, it } from 'vitest';

import { main } from '../src/index.js';

describe('cli executable', () => {
    it('rejects when no input argument is provided', async () => {
        await expect(main(['node', 'bloggymedia'])).rejects.toThrowError('Input path is required');
    });
});
