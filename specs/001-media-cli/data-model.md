# Data Model - Bloggymedia CLI Experience

## Entities

### TargetDirectory
- **Fields**: `path` (string, absolute or relative input), `originalsPath` (string, derived `.originals` under target), `mediaFiles` (list of MediaFile).
- **Validation**: Path must exist and be a directory; subdirectories are ignored during scan.

### MediaFile
- **Fields**: `name` (string, filename only), `type` (enum: image|video), `path` (string, absolute), `backupPath` (string, `.originals/<name>`), `status` (enum: pending|processed|skipped|failed), `error` (optional string).
- **Validation**: Supported extensions only; if `backupPath` exists, status set to `skipped` and file is not modified.

### ProcessingRun
- **Fields**: `targetDirectory` (TargetDirectory), `foundCount` (int), `processedCount` (int), `skippedCount` (int), `failedCount` (int), `missingTools` (list of strings), `startTime`/`endTime` (timestamps).
- **Transitions**: `pending` → `checking-tools` → `scanning` → (`processing` → `completed`) or `failed` if tools missing; if tools missing, no processing occurs.

### Summary
- **Fields**: `processed` (int), `skipped` (int), `failed` (int), `files` (list of filenames processed or skipped), `messages` (list of user-facing strings).
- **Validation**: Counts must reconcile with `foundCount` for the flat directory.

## Relationships
- A `TargetDirectory` contains many `MediaFile` items (flat; no nested directories).
- A `ProcessingRun` references one `TargetDirectory` and aggregates statuses for its `MediaFile` items.
- A `Summary` is produced from a `ProcessingRun`.

## Derived/Computed
- `originalsPath` computed from `targetDirectory.path` + `/.originals`.
- `backupPath` computed per file using `originalsPath` + `name`.
- `remainingCount` = `foundCount - processedCount - skippedCount - failedCount`.

## Notes
- No persistent datastore beyond filesystem copies; backups and outputs coexist with source directory.
- Missing-tool detection occurs before processing; `missingTools` populated and run stops early with exit code ≠0.
