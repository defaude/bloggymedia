# Implementation Plan: Bloggymedia CLI Experience

**Branch**: `001-media-cli` | **Date**: 2025-12-08 | **Spec**: specs/001-media-cli/spec.md
**Input**: Feature specification from `/specs/001-media-cli/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. Align every section with the Constitution Check below.

## Summary

CLI to optimize media in a flat target folder: back up each media file to `.originals`, optimize images (≤1200px, metadata removed) and videos (H.264 ≤720p, metadata removed), skip files with existing backups, ignore subdirectories, and provide continuous progress plus a final summary. Approach: Node 22 + TypeScript strict, tsdown build to `dist/`, Biome-only lint/format, zx-based adapters for `mogrify`/`ffmpeg`, fast-glob for flat file discovery, sequential processing for predictable progress, Vitest-covered CLI/adapters for safety and idempotence.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node 22 (ESM, strict)  
**Primary Dependencies**: zx adapters for `mogrify`/`ffmpeg`, fast-glob for flat scan, tsdown, Biome  
**Storage**: Local filesystem only (`.originals` backups plus optimized outputs)  
**Testing**: Vitest (unit/integration for CLI/adapters)  
**Target Platform**: Local CLI on macOS/Linux Node 22  
**Project Type**: Single-package CLI  
**Performance Goals**: Responsive UX with immediate greeting and per-file progress; sequential processing; no strict p95 target  
**Constraints**: Flat-folder scope only, non-destructive backups, adapter-only external calls, fail fast on missing tools, tsdown emit to `dist/`, Biome-only lint/format  
**Scale/Scope**: Tens to low hundreds of media files per run (blog-sized folders)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Non-destructive plan: backups to `.originals`, idempotent reruns, no writes outside the working directory.
- Tooling boundaries: all external binaries invoked via zx-based adapters in `src/adapters` (no direct shelling out in core).
- Stack compliance: Node 22 + TypeScript `strict`, tsdown build emitting to `dist/` (no `build/`), Biome-managed lint/format (`npm run check`; `npm run check-fix` for safe autofix; `npm run check-fix-unsafe` only with review; no ESLint/Prettier), explicit types for CLI surfaces and adapters.
- Test plan: Vitest coverage for CLI validation, adapter interactions, media bounds, and error paths; integration runs are opt-in.
- UX expectations: progress/output describes backups and processing counts; default media bounds centralized and validated.
- Status: All gates satisfied by the current spec; no exceptions expected.

## Project Structure

### Documentation (this feature)

```text
specs/001-media-cli/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── adapters/           # zx-based wrappers for mogrify/ffmpeg
├── media/              # media processing + filesystem helpers
├── cli.ts              # CLI entrypoint logic
└── index.ts            # main export/runner

test/                   # Vitest suites
├── cli.test.ts
├── filesystem.test.ts
└── processor.test.ts
```

**Structure Decision**: Single-package CLI with zx adapters and media helpers under `src/`; Vitest tests in `test/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | Gates satisfied | N/A |
