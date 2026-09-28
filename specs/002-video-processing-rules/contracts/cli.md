# Contract: CLI Processing

## Command
- `bloggymedia [workingDir]`
  - `workingDir` (optional): directory to scan; defaults to current working directory.

## Inputs
- Supported media extensions: per `VIDEO_EXTENSIONS` (mp4, mov, m4v, mkv, avi) plus images (for coexisting logic).
- External tooling required: `ffmpeg`, `ffprobe`, `mogrify`; absence yields error before processing.

## Behavior
- Discovers media files under `workingDir`.
- For each video:
  - Inspect codec, resolution (orientation-aware), frame rate, metadata, audio tracks, subtitle/data tracks.
  - If compliant (H.264, ≤1280x720 or 720x1280, ≤24fps, no metadata), mark as skipped with no backup or output.
  - If non-compliant or metadata present, back up original to `.originals/` then produce output:
    - Video: H.264, same container/extension, capped to ≤1280x720 (or 720x1280) without upscaling.
    - Frame rate: ≤24fps without upsampling when source is lower.
    - Metadata: stripped from container and streams.
    - Audio: all tracks preserved as-is unless container forbids.
    - Subtitles: keep text-based subtitles/captions; drop binary/attachment/data tracks.
  - Record decision (skip/process) with triggering reasons.
- Reruns:
  - Skips already compliant outputs and avoids duplicate backups for unchanged inputs.
  - Leaves `.originals` intact unless restoration is required after a failure.

## Outputs
- Progress logs per file: status (`processed|skipped|failed`), counts (processed, skipped, failed, remaining), and
  reason if provided.
- Summary logs at completion: totals and file lists per status.
- Exit codes:
  - `0` on successful completion (even with skips).
  - Non-zero on fatal errors (e.g., missing tools, unhandled processing failure).

## Error Cases
- Missing tools → `MissingToolsError` surfaced; no processing attempted.
- Invalid `workingDir` (missing or not a directory) → error and exit.
- Processing failure → attempt restore from backup; mark file failed with reason.
