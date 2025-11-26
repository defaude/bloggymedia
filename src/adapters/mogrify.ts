import { $ } from 'zx';

export type MogrifyOptions = {
    input: string;
    maxSize: string;
};

export async function resizeImage({ input, maxSize }: MogrifyOptions) {
    // Wrapper for mogrify; options will be refined alongside processing logic.
    await $`mogrify -resize ${maxSize} ${input}`;
}
