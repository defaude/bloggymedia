# bloggymedia development

Use Node.js 26 and npm from `~/.n/bin`. This is a TypeScript 7 ESM project with strict type checking. `src/` contains
the CLI, media logic, and external tool adapters; `test/` contains Vitest tests.

`tsconfig.json` extends `@tsconfig/node26` and only overrides `noEmit`. Node types come from the preset; strict checking
is enabled by default in TypeScript 7. Default file discovery includes sources, tests, and tool configurations.
Keep type checking separate from emission: tsdown builds the CLI with the explicit target `node26`.

## Project rules

- Keep file discovery and writes within the selected directory. Inspect media state before processing; skip compliant
  files without writes. Write exclusively reserved temporary outputs, validate them, preserve source mtime, then rename
  over the source. Never write media in place or create backups. Existing `.originals` directories remain untouched.
  Users are responsible for keeping originals separately before running the CLI.
- Keep media limits in `src/media/constants.ts`. Preserve source dimensions and frame rate when they are below the
  limits; do not upscale or add frames.
- Put new external command calls in `src/adapters/` and use typed interfaces for them. The media and CLI modules should
  coordinate processing without constructing tool commands.
- Use Biome for formatting and linting, TypeScript for type checking, and tsdown for builds to `dist/`.
- Wrap Markdown lines close to 120 characters where practical, but never exceed 120. Indent continuation lines in lists.

## Commands

- `npm run check` — type checking and Biome checks
- `npm test` — Vitest; the current suite includes tests that require installed media tools
- `npm run build` — build `dist/index.js`

`README.md` describes the current CLI behavior. `specs/001-media-cli` and `specs/002-video-processing-rules` are
historical. `specs/003-pipeline-overhaul` records the implemented pipeline contract and its acceptance evidence.
It is not an active Spec Kit workflow.
