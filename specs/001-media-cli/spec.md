# Feature Specification: Bloggymedia CLI Experience

**Feature Branch**: `001-media-cli`  
**Created**: 2025-12-07  
**Status**: Draft  
**Input**: User description: "Develop the CLI program. It should have the features as described in the README.md file. The CLI should be simple to use, have a nice UI and always convey the current status to the user. We dont need to focus on edge cases or runtime constraints right now. The core functionality is relevant only. Try to keep the specification brief and dont let it get too complex."

## Clarifications

### Session 2025-12-07

- Q: How should the CLI behave if required external tools (e.g., mogrify/ffmpeg) are missing? → A: Fail fast with a concise message listing missing tools and exit non-zero.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Optimize current folder (Priority: P1)

Run `bloggymedia` with no arguments to optimize all media in the current working directory while seeing live progress.

**Why this priority**: Core promise of a simple, single-command workflow that improves media for blogging.

**Independent Test**: Execute the command in a directory containing mixed media/non-media files and verify processed outputs, backups, and progress display without additional setup.

**Acceptance Scenarios**:

1. **Given** a directory with images, videos, and other files, **When** the user runs `bloggymedia` with no arguments, **Then** only media files are processed, backups appear in `.originals`, and progress shows current file and counts.
2. **Given** media files needing optimization, **When** processing completes, **Then** images are within 1200x1200 with metadata removed and videos are output at or below 720p in H.264 while originals remain untouched.

---

### User Story 2 - Target a specific path (Priority: P2)

Point the CLI at a chosen folder to optimize its media while leaving other locations unchanged.

**Why this priority**: Allows users to process specific project folders without relocating files.

**Independent Test**: Run `bloggymedia /path/to/media` on a sample folder and confirm only that folder’s media is backed up and optimized.

**Acceptance Scenarios**:

1. **Given** a valid folder path, **When** the user runs the CLI with that path, **Then** processing is limited to that folder, non-media files are skipped, and results mirror the default run behavior.

---

### User Story 3 - Understand status and outcomes (Priority: P3)

Track progress during processing and receive a clear summary of results.

**Why this priority**: Continuous feedback builds trust and allows users to react to any issues immediately.

**Independent Test**: Observe the CLI while processing a mixed set of files and verify live status plus a final summary of successes, skips, failures, and file locations.

**Acceptance Scenarios**:

1. **Given** a processing run in progress, **When** the user observes the CLI, **Then** it shows the current file, remaining count, and any encountered errors.
2. **Given** processing finishes, **When** the summary appears, **Then** it lists counts for processed, skipped, and failed files and points to the `.originals` backups.

### Edge Cases

- Directory contains no media files: CLI reports nothing to optimize and exits cleanly without creating backups.
- `.originals` already exists from a prior run: CLI skips any file with an existing backup, leaves it unchanged, and processes only files without backups.
- A file fails to process: CLI continues with remaining files, flags the failure in progress updates, and includes it in the final summary.
- Subdirectories exist under the target directory: CLI ignores them and only processes media in the top-level target folder.
- Required external tools are missing: CLI reports missing tool names, exits non-zero, and does not attempt processing.

## Requirements *(mandatory)*

**Constitution alignment**: Preserve originals via `.originals`, allow idempotent reruns that do not overwrite existing backups, keep external tooling isolated to adapters, honor Node 22 + TypeScript `strict` with tsdown builds to `dist/` only, use Biome for lint/format (`npm run check`; `npm run check-fix` for safe autofix; `npm run check-fix-unsafe` flagged for review; no ESLint/Prettier), enforce media bounds (images ≤1200x1200; videos ≤720p/H.264), fail fast when required external tools are missing, limit processing strictly to files in the target directory (no subdirectory traversal), and maintain clear CLI UX/progress visibility. Call out any intentional deviations.

### Functional Requirements

- **FR-001**: CLI MUST accept an optional target path; when omitted, it defaults to the current working directory.
- **FR-002**: System MUST scan only the files directly within the specified target directory for supported image and video types, ignoring all subdirectories and any paths outside that scope.
- **FR-003**: System MUST create backups of every media file under a `.originals` subdirectory before optimization, preserving directory structure and leaving originals unmodified.
- **FR-004**: System MUST optimize image files by stripping metadata and ensuring neither dimension exceeds 1200 pixels while keeping aspect ratio.
- **FR-005**: System MUST optimize video files by re-encoding to H.264 with a maximum resolution of 720p, stripping metadata, and respecting the original orientation.
- **FR-006**: System MUST keep reruns non-destructive by skipping any file that already has a backup in `.originals`, leaving it unchanged, and avoiding overwriting or duplicating backups.
- **FR-007**: CLI MUST display live progress, including the current file, counts of completed/pending items, and any encountered errors.
- **FR-008**: CLI MUST provide a completion summary that lists counts of processed images/videos, skipped/failed items, and the filenames processed (without full paths), relying on user knowledge that backups live under `.originals/<filename>` and optimized files retain the original filename in place.
- **FR-009**: When a file cannot be processed, the system MUST log the issue, continue with remaining files, and include the failure in the final summary.
- **FR-010**: CLI MUST verify availability of required external tools before processing; if any are missing, it MUST list them clearly and exit with a non-zero status without processing files.

### Key Entities *(include if feature involves data)*

- **Target Directory**: User-selected folder to scan; defines scope for media discovery and where `.originals` is created.
- **Media File**: An image or video identified for processing; attributes include path, type (image/video), and processing status.
- **Processing Run**: A single execution of the CLI; tracks counts of found/processed/skipped/failed files and summary output.

### Assumptions

- Scanning is limited to files in the specified target directory; subdirectories are ignored.
- Supported formats align with common blogging media (e.g., JPEG/PNG for images, MP4/MOV for video).
- Required system tools for image/video processing are expected to be installed; if missing, the CLI fails fast with a clear message and non-zero exit.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Users see an immediate greeting on start and continuously up-to-date progress during processing (current file display never lags behind the actual item being processed).
- **SC-002**: All non-media files remain unchanged after a run, and every processed media file has a corresponding backup in `.originals`.
- **SC-003**: All media files in the target directory without an existing backup are optimized to the target bounds (images ≤1200px with metadata removed; videos in H.264 at or below 720p with metadata removed), and any file with an existing backup is left unchanged and reported as skipped.
- **SC-004**: Final summaries report counts for processed, skipped, and failed files.
