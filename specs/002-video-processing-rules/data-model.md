# Data Model: Video Processing Rules

## Entities

### VideoSource
- `path`: absolute file path
- `container`: extension/container type (e.g., mp4, mov)
- `videoCodec`: codec name (e.g., h264, hevc)
- `resolution`: width x height, orientation-aware
- `frameRate`: nominal/average fps (float)
- `hasMetadata`: boolean (container or stream tags present)
- `audioTracks`: list of tracks with codec, channels, language/tag info
- `subtitleTracks`: list with type (text vs binary/attachment), language/tag info
- `fileSizeBytes`: optional for progress estimates

### InspectionResult
- `sourcePath`: reference to VideoSource.path
- `isCompliant`: boolean (true if H.264, ≤720p oriented, ≤24fps, no metadata)
- `triggers`: set of reasons (e.g., `codec`, `resolution`, `frameRate`, `metadata`, `subtitleAttachment`)
- `timestamp`: inspection time

### ProcessingDecision
- `classification`: `skip` | `process`
- `reasons`: same set as InspectionResult.triggers
- `sourcePath`: reference to VideoSource.path
- `backupPath`: optional when process required
- `outputPath`: optional when process required
- `notes`: optional (e.g., tool errors, attachment drops)

### BackupOriginal
- `path`: location under `.originals`
- `sourcePath`: original file path
- `createdAt`: timestamp of backup creation
- `sizeBytes`: recorded for verification

### OutputVideo
- `path`: final output path
- `container`: matches source container
- `videoCodec`: H.264
- `resolution`: capped to ≤1280x720 or 720x1280 without upscaling
- `frameRate`: ≤24fps without upsampling when source lower
- `metadataStripped`: boolean (expected true)
- `audioTracks`: preserved from source
- `subtitleTracks`: text captions preserved; binary/attachments dropped
- `createdAt`: timestamp

### ProgressRecord
- `fileName`: basename of source
- `status`: `processed` | `skipped` | `failed`
- `reason`: optional reason text
- `processedCount` / `skippedCount` / `failedCount` / `remainingCount`: integers at update time
