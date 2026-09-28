# bloggymedia development

Use Node.js 22 and npm from `~/.n/bin`. This is a TypeScript 5.9 ESM project with strict type checking. `src/` contains
the CLI, media logic, and external tool adapters; `test/` contains Vitest tests.

## Project rules

- Keep file discovery and writes within the selected directory. Back up media to `.originals` before changing it, and
  never overwrite an existing backup.
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

`README.md` describes the current CLI behavior. `specs/` records earlier design work; it is not an active Spec Kit
workflow.
