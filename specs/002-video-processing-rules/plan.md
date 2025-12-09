# Implementation Plan: Video Processing Rules

**Branch**: `[002-video-processing-rules]` | **Date**: 2025-12-08 | **Spec**: /Users/defaude/projects/defaude/bloggymedia/specs/002-video-processing-rules/spec.md
**Input**: Feature specification from `/specs/002-video-processing-rules/spec.md`

**Note**: Filled via `/speckit.plan`. Sections align with the Constitution Check below.

## Summary

Limit processing to non-compliant videos only (non-H.264, >1280x720 or 720x1280, >24fps, or metadata present); skip compliant videos without backups or outputs. When processing, back up the original, emit H.264 in the same container with resolution ≤1280x720 (or 720x1280), frame rate ≤24fps (no upsampling), all metadata stripped, audio preserved, text subtitles kept, and binary/data tracks dropped; record per-file decisions.

## Technical Context

**Language/Version**: TypeScript 5.9 (ESM) on Node 22  
**Primary Dependencies**: zx adapters for ffmpeg/ffprobe/mogrify, fast-glob for discovery, tsdown build, Biome for lint/format, Vitest for tests  
**Storage**: Local filesystem only (`.originals` backups plus optimized outputs)  
**Testing**: Vitest (unit + integration with tool mocks; opt-in real-tool checks)  
**Target Platform**: Node 22 CLI (macOS/Linux)  
**Project Type**: Single CLI package  
**Performance Goals**: Classification within ~1s per file on typical hardware; processing enforces ≤720p and ≤24fps without upscaling/upsampling; skip path is O(1) after inspection  
**Constraints**: No direct shelling from core (adapters only); no upscaling or frame upsampling; preserve container and audio; strip metadata; backups only when processing; builds emit to `dist/`; Biome-only lint/format  
**Scale/Scope**: Batch directories of tens to low hundreds of media files per run; no distributed processing assumed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Status: PASS (no exceptions planned).

- Non-destructive plan: Backups created only for files that will be processed; skipped files untouched; reruns avoid duplicate backups.  
- Tooling boundaries: ffmpeg/ffprobe/mogrify invoked via zx adapters in `src/adapters`; core logic will not shell out.  
- Stack compliance: Node 22 + TypeScript `strict`, tsdown output to `dist/`, Biome-only lint/format; no ESLint/Prettier.  
- Test plan: Vitest coverage for classification, skip/process decisions, adapter calls, 24fps cap, metadata stripping, rerun idempotence, and missing-tool errors; integration tests opt-in.  
- UX expectations: CLI progress reflects backup/processing counts; defaults for media bounds centralized and validated (images ≤1200x1200, videos ≤720p/H.264, ≤24fps).

## Project Structure
### Documentation (this feature)

```text
specs/002-video-processing-rules/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
```

### Source Code (repository root)

```text
src/
├── adapters/
├── media/
├── cli.ts
└── index.ts

test/
└── ... (Vitest suites)
```

**Structure Decision**: Single CLI package with adapters + media services; documentation for this feature lives under `specs/002-video-processing-rules/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Outline & Research

- Extracted unknowns: none blocking; captured best-practice decisions for video inspection, classification thresholds, metadata stripping, subtitle handling, and idempotent backups.  
- Output: /Users/defaude/projects/defaude/bloggymedia/specs/002-video-processing-rules/research.md

## Phase 1: Design & Contracts

- Data model: /Users/defaude/projects/defaude/bloggymedia/specs/002-video-processing-rules/data-model.md  
- Contracts: /Users/defaude/projects/defaude/bloggymedia/specs/002-video-processing-rules/contracts/cli.md  
- Quickstart: /Users/defaude/projects/defaude/bloggymedia/specs/002-video-processing-rules/quickstart.md  
- Agent context updated via `.specify/scripts/bash/update-agent-context.sh codex`

## Phase 2: Tasks (deferred to `/speckit.tasks`)

- Implementation task breakdown will be generated separately via `/speckit.tasks` after this plan.

## Verification

- 2025-12-08: `npm run check` (pass); `npm test` (pass).
