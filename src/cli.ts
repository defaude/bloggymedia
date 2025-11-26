export type CliOptions = {
    input: string;
};

export async function runCli(options: CliOptions) {
    // Placeholder for orchestrating the pipeline; wiring will come in later tasks.
    // For now we only validate presence of input.
    if (!options.input) {
        throw new Error('Input path is required');
    }
}
