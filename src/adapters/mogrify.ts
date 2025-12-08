import { $ } from 'zx';

export type MogrifyOptions = {
    input: string;
    maxSize: string;
};

export async function resizeImage({ input, maxSize }: MogrifyOptions) {
    await $`mogrify -strip -resize ${maxSize}\\> ${input}`;
}
