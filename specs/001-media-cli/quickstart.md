# Quickstart - Bloggymedia CLI

## Prerequisites
- Node 22 installed.
- External tools: `mogrify` (ImageMagick) and `ffmpeg` available on PATH.

## Setup
```bash
npm install
npm run build
```

## Run
```bash
# Process current directory
node dist/index.js

# Or target a specific folder
node dist/index.js ./path/to/media
```

## Test & Check
```bash
npm run check
npm test
```

## Notes
- Only files in the specified directory are processed; subdirectories are ignored.
- Existing backups in `.originals/<filename>` cause files to be skipped and reported as skipped.
- Missing required tools results in a clear error listing the tools and a non-zero exit.
