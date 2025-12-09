# Research: Video Processing Rules

## Findings & Decisions

- **Decision**: Use `ffprobe` via the existing zx adapter to inspect codec, container, resolution (with orientation-aware width/height), nominal/average frame rate, metadata presence, audio tracks, and subtitle/data tracks.  
  **Rationale**: ffprobe provides stable, structured stream/container details needed for skip vs process decisions without modifying files.  
  **Alternatives considered**: Parsing via other libraries (less complete metadata), custom parsing (higher effort, brittle), shelling directly (violates adapter rule).

- **Decision**: Skip criteria = video stream already H.264, resolution ≤1280x720 (or 720x1280 for vertical), frame rate ≤24fps (fractional like 23.976 allowed), and no metadata.  
  **Rationale**: Matches feature spec intent to avoid unnecessary work when outputs would be identical.  
  **Alternatives considered**: Skipping only on codec match (would miss metadata stripping); skipping when any single criterion matches (risks processing needed files).

- **Decision**: Process criteria = any non-H.264 codec, resolution above the cap, frame rate above 24fps, or any metadata present.  
  **Rationale**: Ensures all outputs converge to the target profile and are metadata-free.  
  **Alternatives considered**: Ignoring metadata-only changes (would violate requirement to strip metadata), ignoring slight frame-rate overruns (risks non-compliance).

- **Decision**: Processing outputs re-encode video to H.264 in the original container/extension, cap resolution to 1280x720 (or 720x1280) without upscaling, cap frame rate at 24fps without upsampling, strip all metadata, preserve all audio tracks, keep text-based subtitle/caption tracks, and drop binary/attachment/data tracks.  
  **Rationale**: Meets spec and clarification for subtitle handling while avoiding unexpected payloads.  
  **Alternatives considered**: Rewrapping without re-encode (would fail on non-H.264), stripping all subtitle tracks (loses accessibility), keeping all attachments (adds risk/size).

- **Decision**: Back up originals only when processing is required, before any modifications; reruns avoid duplicate backups and skip already compliant outputs.  
  **Rationale**: Aligns with non-destructive principle while honoring the “skip” requirement for compliant files.  
  **Alternatives considered**: Always backing up before inspection (wastes space), backing up after processing (risk of losing source on failure).

- **Decision**: Performance assumption = inspection completes in ~1s per file on typical hardware; processing time dominated by encoding but must enforce caps without upscaling/upsampling; batch scale is tens to low hundreds of files.  
  **Rationale**: Fits CLI use case and supports progress reporting; no distributed processing expected.  
  **Alternatives considered**: Higher-scale distributed assumptions (not needed), per-frame optimization targets (premature for scope).
