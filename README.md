# bloggymedia

Optimize images and videos for blogging in one directory.

## Requirements

- Node.js 22
- `mogrify`, `ffmpeg`, and `ffprobe` on `PATH`

## Usage

```sh
bloggymedia [directory]
```

The directory defaults to the current working directory. Only files directly in that directory are considered;
subdirectories and other file types are left untouched. Files are handled one at a time, with progress and a final
filename summary.

- Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) are backed up to `.originals/<filename>`, stripped of metadata, and
  reduced to fit within 1200 × 1200 pixels.
- Videos (`.mp4`, `.mov`, `.m4v`, `.avi`) are inspected first. A video already using H.264, within 1280 × 720 pixels
  (720 × 1280 in portrait), at no more than 24 fps, and without relevant metadata is left untouched. Other videos are
  backed up and re-encoded to meet those limits. The processor keeps the original file extension and maps audio and text
  subtitle tracks to the output.
- A file with an existing backup in `.originals` is left untouched on later runs. Failures are reported per file, and
  processing continues with the remaining files.

To run a local checkout:

```sh
npm install
npm run build
node dist/index.js [directory]
```
