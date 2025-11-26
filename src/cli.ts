export type CliOptions = {
    workingDir?: string;
};

export async function cli({ workingDir = process.cwd() }: CliOptions) {
    console.log(`Hello, world! We are working in ${workingDir}`);
}
