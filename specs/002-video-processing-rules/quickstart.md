# Quickstart: Video Processing Rules

## Prerequisites
- Node 22 installed.
- External tools available on PATH: `ffmpeg`, `ffprobe`, `mogrify`.

## Setup
```bash
npm install
npm run check
npm test
npm run build
```

## Run the CLI
```bash
node dist/index.js /path/to/media-dir
```
- `workingDir` argument is optional; defaults to current directory.
- Progress logs show per-file status and counts; summary printed at end.

## Expected Behavior
- Videos are skipped if already H.264, ≤1280x720 (or 720x1280), ≤24fps, and contain no metadata; skipped files do not create `.originals` backups or outputs.
- Non-compliant or metadata-bearing videos are backed up to `.originals/` then processed to H.264 in the same container, capped to 720p/24fps without upscaling/upsampling, with metadata stripped and audio preserved; text subtitles kept, binary/attachment/data tracks dropped.
- Reruns avoid duplicate backups and do not reprocess compliant outputs.
