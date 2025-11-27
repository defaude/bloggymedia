<!--
Sync Impact Report
Version change: N/A → 1.0.0
Modified principles: Initialized core principles (I–V)
Added sections: Core Principles content, Technical Constraints & Stack, Workflow & Quality Gates, Governance detail
Removed sections: None
Templates requiring updates: .specify/templates/plan-template.md ✅ | .specify/templates/spec-template.md ✅ | .specify/templates/tasks-template.md ✅ | .specify/templates/commands/ (not present) ⚠ pending if added later
Follow-up TODOs: None
-->

# bloggymedia Constitution

## Core Principles

### I. Reuse First via Adapters
Prefer existing libraries and system tools (e.g., ffmpeg, mogrify, fast-glob) before writing bespoke code. All external tool invocations are isolated behind dedicated adapter functions built with zx so call sites stay testable and portable. Add custom logic only when configuration or upstream improvements are insufficient, and document why in the change description to preserve maintainability.

### II. Safe Media Processing Pipeline
Media optimization is non-destructive: all originals are copied into `.originals` before any transformation, and non-media files remain untouched. Every run must be idempotent for already-processed inputs. Outputs obey fixed constraints—metadata stripped, images capped at 1200x1200, videos re-encoded to H.264 with a 720p ceiling respecting orientation—and the CLI fails fast with clear errors if required tooling is missing or inputs violate constraints.

### III. Type-Safe Delivery & Build Integrity
The codebase is TypeScript-only and targets the current Node 22 toolchain. Builds run through tsdown; direct edits to `dist/` are forbidden. TypeScript and tsdown warnings are treated as errors, and published CLI surfaces remain consistent with the bundled output to ensure predictable installs.

### IV. Tests & Fixtures Drive Changes
New behavior ships with vitest coverage—favoring integration around the CLI and adapter boundaries—with failing tests added before fixes whenever feasible. Media fixtures live in `fixtures/` and are fetched via `npm run download-fixtures`; committed fixtures are immutable, and new fixtures are added through the downloader. Tests must be deterministic (no network, time, or host-specific assumptions).

### V. Linting & CLI Experience
`npm run check` (tsc + biome) must pass before merge to keep code quality and formatting consistent. The CLI communicates progress on stdout, failures on stderr, returns non-zero on errors, and logs invoked external commands or paths when helpful for debugging without leaking sensitive data. Defaults favor the current working directory while handling missing dependencies gracefully.

## Technical Constraints & Stack

- Language/runtime: Node.js with TypeScript targeting Node 22; ESM throughout.
- Build: tsdown for bundling; do not edit generated `dist/` artifacts.
- Tooling: zx for shell orchestration, wrapped in adapters; biome for lint/format; vitest for tests.
- Media processing: relies on ffmpeg/mogrify and related system codecs; keep these declared in docs and surfaced in error messages when absent.
- Fixtures: stored in `fixtures/`; downloader script (`npm run download-fixtures`) is the only supported way to add/update media samples.

## Workflow & Quality Gates

- Plan and specs must acknowledge constitution gates before implementation (see template “Constitution Check”).
- Every change runs `npm run check` and targeted vitest suites; reject changes that relax media safety constraints or adapter boundaries.
- Code reviews verify adapter usage for external tools, non-destructive media handling (.originals), and adherence to output limits (metadata stripping, resize bounds, H.264 @ 720p).
- Update AGENTS.md/PLAN.md when workflows or heuristics change; keep documentation in English.

## Governance

This constitution supersedes informal practices. Amendments require a documented proposal, review for compliance impact, and an explicit version bump recorded below. Semantic versioning applies: MAJOR for breaking governance or removed principles; MINOR for new or materially expanded principles/sections; PATCH for clarifications without behavioral change. Compliance is checked in PR reviews and in the “Constitution Check” section of plans/specs; deviations must be justified and time-bounded.

**Version**: 1.0.0 | **Ratified**: 2025-11-27 | **Last Amended**: 2025-11-27
