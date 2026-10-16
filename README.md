# bloggymedia

Optimize images and videos for blogging in one directory.

## Requirements

- Node.js 26
- ImageMagick 7 (`magick` and `mogrify`), `ffmpeg`, and `ffprobe` on `PATH`

## Usage

```sh
bloggymedia [directory]
```

The directory defaults to the current working directory. Only files directly in that directory are considered;
subdirectories and other file types are left untouched. Files are handled one at a time, with progress and a final
filename summary.

There are no backups. Keep originals elsewhere before running the CLI if you need to retain them.
Existing `.originals` directories are never read for decisions, modified, migrated or removed.

- Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, case insensitive) are inspected across all frames and canvases.
  Images within 1200 × 1200 pixels without removable metadata are skipped. Other images undergo the existing
  `mogrify -strip -resize '1200x1200>'` operation on a temporary copy, retaining format, filename and extension.
- Videos (`.mp4`, `.mov`, `.m4v`, `.mkv`, `.avi`, case insensitive) are inspected first. H.264 videos within
  1280 × 720 pixels (720 × 1280 in portrait), at no more than 24 fps, without relevant metadata or excluded streams
  are skipped. Other videos use `libx264`, CRF 23 and preset `slow`. Audio and text subtitles are copied;
  binary subtitles, data, attachments, metadata and chapters are removed by the existing operation.
  Dimensions and frame rate are never increased; the existing even-dimension rounding is retained.
- Processing uses an exclusively reserved temporary file in the selected directory, retaining the media extension.
  The output must be nonempty, readable, compliant and match the planned dimensions and retained content, including
  animation frames/timing and copied audio/subtitle payloads. Video checks compare decoded frame count and
  presentation coverage independently of container duration, which may be prolonged by audio.
  Missing required timing evidence prevents acceptance. Only then does a rename replace the input.
  Filenames and extensions stay the same. There is no automatic conversion to a different container.
- The original filesystem modification time is restored after the last media write, before replacement.
  Tests on this macOS filesystem preserve deliberately set fractional timestamps within 0.002 milliseconds;
  other filesystems may have coarser precision. Nanosecond preservation is not promised.
- A subsequent run decides from file contents again. Compliant skips invoke no writing encoder and leave bytes
  and mtime unchanged. No processing marker, backup lookup or timestamp comparison determines compliance.
- Symlinks are excluded. Unknown flags and multiple directory arguments are invocation errors.
  Each selected file reports `processed`, `skipped` with reason `compliant`, or `failed` with its phase and reason.
  Per-file failures preserve the source and processing continues; as before, they do not set a failing exit code.
  Fatal directory/tool/invocation failures exit with code 1. An empty directory exits successfully.

Failures before replacement attempt to clean up only the current transaction's temporary file. SIGINT/SIGTERM
abort child tools, preserve uncommitted inputs and attempt cleanup (exit 130/143). SIGKILL or power loss can leave
`.bloggymedia-<uuid>.<extension>` artifacts. They are not automatically deleted on later runs; review any leftovers
manually. Concurrent runs or external changes to the same directory are not a supported operating mode.

The existing media policy can reject an otherwise readable tool output: with FFmpeg 9.0.2, Matroska emits
`ENCODER`/`DURATION` tags and AVI emits `software`, all relevant under the existing video metadata rules.
The CLI therefore reports validation failures for these cases and keeps the input. It does not loosen the rules,
change the container or add another encoding pass. See the acceptance report for the reproducible cases.

Optimized animations with partial frame rectangles or offsets are safely rejected when their canvas needs resizing.
The existing `mogrify` operation resizes each rectangle independently and can leave small rectangles and offsets
unscaled. A partial-frame GIF that would change the spatial composition reports a validation error; its source bytes
and mtime remain unchanged and its temporary output is removed. No coalescing or new animation pipeline is introduced.

Video frame-count checks require equal counts at unchanged constant frame rate. The existing `-r` operation resamples
variable-rate video and capped frame rates, so these cases use decoded coverage and the target rate instead.
Rounding allows one fewer boundary frame or up to two additional frames from the existing FFmpeg synchronizer.
The acceptance report explains the measured behavior and temporal tolerances; exact VFR timestamps are not preserved.

To run a local checkout:

```sh
npm install
npm run build
node dist/index.js [directory]
```

## Development

Use Node.js 26 and npm from `~/.n/bin`. TypeScript 7 checks the project using `@tsconfig/node26` with `noEmit` enabled;
tsdown produces the CLI with the build target `node26`.

```sh
npm run check
npm test
npm run build
```

The test suite includes integration tests that use the installed media tools.
The [pipeline contract](specs/003-pipeline-overhaul/plan.md) and
[acceptance report](specs/003-pipeline-overhaul/report.md) document the implementation and tested limits.
The real CLI integration tests build the executable, generate isolated fixtures and process copies only.
