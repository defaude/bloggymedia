# Quickstart - Bloggymedia CLI

## Prerequisites
- Node 22 installed.
- External tools: `mogrify` (ImageMagick) and `ffmpeg` available on PATH.

## Setup
```bash
npm install
npm run build # tsdown emits dist/ (no build/ directory)
```

## Run
```bash
# Process current directory
node dist/index.js

# Or target a specific folder
node dist/index.js ./path/to/media
```

## Check & Test
```bash
npm run check              # tsc + biome (lint/format)
npm run check-fix          # safe biome autofix
npm run check-fix-unsafe   # opt-in autofix; review for behavior changes
npm test
```

## Notes
- Linting/formatting uses Biome only (no ESLint/Prettier).
- Only files in the specified directory are processed; subdirectories are ignored. Runs are sequential by default.
- Existing backups in `.originals/<filename>` cause files to be skipped and reported as skipped (files with backups are never overwritten).
- Missing required tools results in a clear error listing the tools and a non-zero exit. For help, ensure `mogrify` (ImageMagick) and `ffmpeg` are on PATH.
