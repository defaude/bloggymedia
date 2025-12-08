# CLI Contract - Bloggymedia

## Command

```bash
bloggymedia [targetPath]
```

- `targetPath` (optional): directory to process; defaults to current working directory.
- Scope: only files in the target directory (flat); subdirectories ignored.

## Behavior

- Validate required tools (`mogrify`, `ffmpeg`) before processing; if any missing, list them and exit with non-zero status without processing files.
- For each media file in the target directory:
  - If `.originals/<filename>` already exists, skip the file (report as skipped).
  - Otherwise, create backup in `.originals/<filename>`, then optimize:
    - Images: strip metadata; constrain to ≤1200px on longest side, preserve aspect ratio.
    - Videos: re-encode to H.264 with max resolution 720p, strip metadata, and preserve orientation.
- Non-media files are untouched.

## Output & Progress

- Immediate greeting on start, then live progress per file: current filename, counts (processed/skipped/failed/remaining), and any errors.
- On completion: summary with counts and filenames (no full paths); skipped files include those with existing backups.

## Exit Codes

- `0`: Completed processing (with possible skipped files reported).
- `>0`: Missing tools, input validation failure, or unrecoverable processing error.

## Errors

- Missing tools: list missing tool names and exit.
- Invalid directory: report and exit non-zero without processing.
- Per-file failures: log error, continue with remaining files, and include in summary/failed count.
