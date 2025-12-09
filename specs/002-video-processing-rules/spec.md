# Feature Specification: Video Processing Rules

**Feature Branch**: `[002-video-processing-rules]`  
**Created**: 2025-12-08  
**Status**: Draft  
**Input**: User description: "I want to improve video processing. Videos should only be marked for processing if any of those conditions are met: - the input video is using a different codec than h.264 - the input video is bigger than 1280x720 pixels (or 720x1280, depending on orientation) - the input video has a framerate higher than 24fps - the input video has any metadata in it If none of those conditions are met, the video should be skipped. This means its not even backed up into the .originals folder, because the input file wont be changed, at all. If a video is selected for processing, then the original file is backed up into .originals. - The desired output codec is always h.264. File extension / video container should remain stable, though. - The maximum desired output resolution is 1280x720 (or 720x1280). If the input video is smaller, it should not be upscaled, but retain the input videos original resolution.
 - The maximum desired output framerate is 24fps. If the input video has a lower framerate, it should not be upsamled, but retain the input videos original framerate. - The output video should be stripped of all metadata. - The output video should contain the original audio track of the input video."

## Clarifications

### Session 2025-12-08

- Q: How should subtitle/data tracks be handled during processing? → A: Keep text-based subtitle/caption tracks; drop binary/attachment/data tracks.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Skip compliant videos (Priority: P1)

Operators can run the media processor and have already compliant videos automatically skipped with no copies created.

**Why this priority**: Avoids unnecessary processing and storage while keeping reruns safe.

**Independent Test**: Run processing on a video that meets codec/resolution/frame-rate/metadata rules and confirm it is marked skipped with no new files.

**Acceptance Scenarios**:

1. **Given** a video that is H.264, at or below 1280x720 (or 720x1280), at or below 24fps, and without metadata, **When** the processor runs, **Then** the video is marked skipped, not copied to `.originals`, and no output file is generated.
2. **Given** the same compliant video after a previous run, **When** processing is rerun, **Then** it remains skipped with no new backups or outputs created.

---

### User Story 2 - Process non-compliant videos (Priority: P2)

Operators can process videos that violate any codec, resolution, frame rate, or metadata rule, producing a compliant output.

**Why this priority**: Ensures all delivered videos meet the target profile and removes unwanted metadata.

**Independent Test**: Run processing on a video exceeding at least one rule and verify a compliant output and an original backup are produced.

**Acceptance Scenarios**:

1. **Given** a video with a non-H.264 codec, resolution above 1280x720 (or 720x1280), or frame rate above 24fps, **When** the processor runs, **Then** the original is copied into `.originals` and an output is created in the same container with H.264 video, capped resolution, capped frame rate, no metadata, and original audio intact.
2. **Given** a video that only contains metadata but otherwise meets codec, resolution, and frame-rate limits, **When** the processor runs, **Then** the original is backed up and the output strips metadata while retaining the source resolution, frame rate, container, and audio.

---

### User Story 3 - Preserve audio and container identity (Priority: P3)

Operators can rely on outputs keeping the same container and audio while meeting video rules.

**Why this priority**: Avoids compatibility issues and maintains audio fidelity.

**Independent Test**: Compare input/output streams to confirm container and audio tracks match while video meets the target profile.

**Acceptance Scenarios**:

1. **Given** a video needing video conversion, **When** processing completes, **Then** the output keeps the original container/extension and all original audio tracks with timing preserved.
2. **Given** a video with multiple audio tracks or language tags, **When** processing completes, **Then** all audio tracks and tags remain unchanged in the output.

### Edge Cases

- Videos exactly at 1280x720 or 720x1280, at 24fps, H.264, and without metadata are skipped with no backup.
- Sources with common fractional rates (e.g., 23.976fps) remain unprocessed; rates above 24.0 (e.g., 24.01fps) trigger processing.
- Small or low-frame-rate sources (e.g., 480p, 10fps) are not upscaled or upsampled.
- Vertical videos apply the 720px cap appropriate to orientation while preserving aspect ratio.
- Files requiring only metadata stripping still trigger backup plus output but keep original video dimensions and frame cadence.
- Rerunning the pipeline on already processed outputs does not create extra backups or re-transcode.

## Requirements *(mandatory)*

**Constitution alignment**: Capture non-destructive handling (backups in `.originals`, idempotent reruns), adapter-only external tooling (zx in `src/adapters`), Node 22 + TypeScript `strict` with tsdown builds to `dist/` (no `build/`), Biome-managed lint/format commands (`npm run check`; `npm run check-fix` for safe autofix; `npm run check-fix-unsafe` flagged for review; no ESLint/Prettier), default media bounds (images ≤1200x1200; videos ≤720p/H.264 with outputs capped at 24fps via downsampling) and CLI UX/progress expectations. State when deviations are intentional.

### Functional Requirements

- **FR-001**: System MUST inspect each input video to capture video codec, container/extension, resolution (width and height with orientation), nominal/average frame rate, and detect any container or stream metadata tags.
- **FR-002**: System MUST classify a video as "skip" when the video stream is H.264, resolution is at or below 1280x720 (or 720x1280 for vertical), frame rate is at or below 24fps, and no metadata is present; skipped videos are left untouched and are not copied into `.originals`.
- **FR-003**: System MUST classify a video as "process" when any of the following are true: video codec is not H.264, resolution exceeds the 1280x720 (or 720x1280) cap, frame rate exceeds 24fps, or metadata exists; this classification triggers conversion.
- **FR-004**: When processing is required, System MUST back up the exact original file into `.originals` before any modification and prevent duplicate backups for repeat runs of unchanged inputs.
- **FR-005**: Processing outputs MUST keep the same container/extension as the input while encoding the video stream to H.264.
- **FR-006**: Processing outputs MUST cap resolution to a maximum of 1280x720 (or 720x1280 for vertical orientation) while preserving aspect ratio and avoiding any upscaling beyond source dimensions.
- **FR-007**: Processing outputs MUST cap frame rate at 24fps; inputs at or below 24fps retain their original cadence without frame insertion or duplication.
- **FR-008**: Processing outputs MUST strip all metadata from container and streams (including orientation/tags) so outputs contain only necessary structural information.
- **FR-009**: Processing outputs MUST preserve all original audio tracks (codecs, channels, language tags) without re-encoding unless unavoidable for container compatibility, ensuring audio remains synchronized.
- **FR-010**: System MUST record per-file decisions and actions (skip vs process and the specific condition triggered) to support validation and auditing.
- **FR-011**: System MUST avoid reprocessing already compliant outputs on rerun and must not create additional backups or outputs for unchanged files.
- **FR-012**: Processing outputs MUST retain text-based subtitle/caption tracks while dropping binary, attachment, or data tracks to prevent unintended payloads.

### Key Entities *(include if feature involves data)*

- **Video Source**: Path, container/extension, video codec, resolution (width x height), frame rate, metadata presence, audio track details.
- **Processing Decision**: Classification (skip/process), triggered conditions, references to source and resulting output/backup paths.
- **Output Video**: Container/extension, video stream in H.264 meeting resolution and frame-rate caps, all metadata stripped, audio tracks preserved.
- **Backup Original**: Stored copy of the unmodified source in `.originals` tied to the input path and decision record.

### Assumptions

- Frame-rate comparisons use nominal/average values; fractional rates like 23.976fps count as compliant (≤24), while any value above 24 triggers processing.
- "Metadata" includes any container or stream-level tags (e.g., title, orientation, EXIF) beyond structural necessities; the presence of any such tags triggers processing.
- All existing audio tracks are expected to be preserved as-is in outputs unless the container would reject them; no new audio is added.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of videos meeting codec/resolution/frame-rate/no-metadata rules are skipped with no `.originals` backup and no new output files.
- **SC-002**: 100% of processed outputs use H.264 video in the original container, have resolution ≤1280x720 (or 720x1280) with no upscaling, and have frame rate ≤24fps without upsampling when the source is lower.
- **SC-003**: 100% of processed outputs contain no metadata while retaining all original audio tracks and synchronization.
- **SC-004**: Per-file decision records exist for 100% of processed or skipped videos, and rerunning the pipeline on unchanged inputs yields zero additional backups or outputs.
