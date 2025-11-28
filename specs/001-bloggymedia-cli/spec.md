# Feature Specification: Bloggymedia CLI Media Optimizer

**Feature Branch**: `[001-bloggymedia-cli]`  
**Created**: 2025-11-27  
**Status**: Draft  
**Input**: User description: "CLI to optimize media files in a directory for blogging; only direct children; back up originals into `.bloggymedia-originals` without renaming; images max 1200x1200 via mogrify + metadata strip + optional optimizers; videos inspected via ffprobe, re-encode to H.264 720p/30fps with metadata stripped and audio copied when needed; skip re-encode when already compliant; live TUI with progress, warnings, errors, final stats; non-media untouched; never clean backups; accept uppercase extensions."

> Constitution alignment: keep media handling non-destructive (back up to `.bloggymedia-originals` without altering filenames), enforce image (≤1200x1200) and video (H.264 ≤720p, ≤30fps, metadata stripped) constraints, route external tools through zx adapters, stick to TypeScript/tsdown, and plan deterministic vitest coverage with sample files from the `fixtures/` directory.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Optimize media in a directory (Priority: P1)

Run the CLI on a directory of mixed media to produce optimized images/videos, with originals safely backed up and a clear summary.

**Why this priority**: Core value of the tool—must safely optimize media for blogging with backups and report results.

**Independent Test**: With a directory containing images and videos, run `bloggymedia <dir>` and verify backups in `.bloggymedia-originals`, resized/encoded outputs in place, and summary with counts/size deltas.

**Acceptance Scenarios**:

1. **Given** a directory with images/videos, **When** `bloggymedia <dir>` runs, **Then** every media file is backed up to `.bloggymedia-originals` (no overwrite) before processing and optimized in place.
2. **Given** successful processing, **When** the CLI exits, **Then** it shows counts for images/videos, per-file size deltas, and total bytes saved.

---

### User Story 2 - Respect non-media and filenames (Priority: P1)

Ensure non-media files remain untouched and filenames retain original casing and spelling.

**Why this priority**: Prevents accidental corruption/renames of unrelated content and honors user filenames.

**Independent Test**: With a directory containing non-media files and uppercase extensions on media, run `bloggymedia` and confirm only supported media are processed, others remain unchanged, and filenames stay identical.

**Acceptance Scenarios**:

1. **Given** files with unsupported extensions or subdirectories, **When** processing runs, **Then** those entries are skipped without modification.
2. **Given** media files with uppercase extensions, **When** processing runs, **Then** they are classified and processed without changing their names/casing.

---

### User Story 3 - Video smart re-encode (Priority: P2)

Skip expensive re-encodes when a video already meets targets; otherwise re-encode correctly with audio preserved.

**Why this priority**: Saves time/resources and ensures consistent output quality.

**Independent Test**: Provide one compliant H.264 720p/≤30fps video and one non-compliant; run CLI and verify compliant video is skipped (still backed up, metadata stripped), non-compliant is re-encoded to targets with audio copied.

**Acceptance Scenarios**:

1. **Given** a compliant video, **When** inspected, **Then** metadata is stripped, but video is not re-encoded and remains H.264 ≤720p ≤30fps.
2. **Given** a 1080p non-H.264 video at >30fps, **When** processed, **Then** output is H.264 yuv420p, max 720p, capped 30fps, audio copied, metadata stripped.

---

### User Story 4 - Clear errors and tool availability (Priority: P2)

Surface actionable errors per file and warn when required/optional tools are missing.

**Why this priority**: Users need to know what failed and how to fix environment/tool issues.

**Independent Test**: Temporarily hide `ffmpeg` or `mogrify` from PATH and run CLI; verify warnings explain missing tools and processing halts or skips gracefully with file-specific errors.

**Acceptance Scenarios**:

1. **Given** `ffmpeg` is missing, **When** a video is encountered, **Then** the CLI warns clearly (naming the file and missing tool) and marks that job as failed without corrupting files.
2. **Given** `optipng` is missing, **When** a PNG is processed, **Then** image still resizes/strips metadata, and a warning notes the optional optimizer skip.

---

### Edge Cases

- What happens when the directory has zero media files? → CLI should report nothing to process and exit cleanly with summary of zero changes.
- How does system handle existing backups in `.bloggymedia-originals`? → Warn once per file and never overwrite; continue processing current file.
- How to treat subdirectories? → Ignore them entirely (no traversal, no changes).
- What if a command fails mid-file (e.g., ffmpeg error)? → Surface file-specific error, leave original backed up, avoid partial overwrite (use temp output then replace).
- How to handle corrupted or zero-byte media files? → Fail that file with clear error, continue others.
- What if optimized output is larger than original? → Still replace (per current spec) but report size delta; consider future toggle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: CLI MUST accept an optional directory argument (default cwd) and error on non-existent or non-directory input.
- **FR-002**: System MUST scan only direct children of the target directory, ignoring subdirectories and `.bloggymedia-originals`.
- **FR-003**: System MUST classify media case-insensitively by extension (images: jpg/jpeg/png/webp/gif; videos: mp4/mov/avi/mkv) without renaming filenames.
- **FR-004**: System MUST back up each media file to `<workingDir>/.bloggymedia-originals` before mutation, creating the directory as needed, never overwriting existing backups, and emitting a warning on backup collisions.
- **FR-005**: System MUST leave non-media files untouched.
- **FR-006**: For images, System MUST resize in place to fit within 1200x1200 using `mogrify -resize 1200x1200\>` and strip metadata; it SHOULD attempt format-appropriate optimizers when available without failing if missing.
- **FR-007**: For videos, System MUST inspect via `ffprobe` (codec, width, height, fps, audio) and decide whether to skip re-encode when H.264, ≤720p max dimension, and fps ≤30.
- **FR-008**: When re-encode is needed, System MUST use `ffmpeg` to output H.264 yuv420p, max 720p with aspect ratio preserved, fps capped at 30, audio stream copied when present, metadata stripped, writing to temp then replacing source on success.
- **FR-009**: System MUST strip metadata from videos even when re-encode is skipped (e.g., via copy + `-map_metadata -1`).
- **FR-010**: System MUST produce a live TUI showing queue status per file (pending/processing/done/skipped/warn/error) with spinners/progress.
- **FR-011**: System MUST emit clear warnings/errors referencing the specific file and failing tool/command.
- **FR-012**: On completion, System MUST show counts for processed images/videos, skipped files, failures, per-file size deltas (bytes and %), and total bytes saved.
- **FR-013**: System SHOULD detect missing required tools (`mogrify`, `ffmpeg`, `ffprobe`) and optional optimizers, warning appropriately.

### Key Entities *(include if feature involves data)*

- **MediaJob**: Represents one file with type (image/video/other), path (original casing), backup path, status, warnings/errors, and size metrics before/after.
- **RunStats**: Aggregated counts (images/videos processed/skipped/failed), total bytes saved, per-file deltas for reporting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running `bloggymedia` on a directory with ≥1 image and ≥1 video produces backups in `.bloggymedia-originals` and optimized in-place outputs with unchanged filenames.
- **SC-002**: Compliant videos are skipped for re-encode yet still have metadata stripped and are reported as such.
- **SC-003**: Missing required tool produces a user-visible warning/error naming the file/tool and leaves source files uncorrupted.
- **SC-004**: Completion summary reports per-file size deltas and aggregate totals; non-media files remain byte-identical pre/post run.
