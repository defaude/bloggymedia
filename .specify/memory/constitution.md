<!--
Sync Impact Report
- Version: 1.1.0 -> 1.2.0
- Modified principles: Safe Media Handling (Non-Destructive); Technical Standards & Stack; Development Workflow & Quality Gates
- Added sections: None
- Removed sections: None
- Templates requiring updates: ✅ .specify/templates/plan-template.md; ✅ .specify/templates/spec-template.md; ✅ .specify/templates/tasks-template.md; ⚠️ None
- Follow-up TODOs: None
-->

# bloggymedia Constitution

## Core Principles

### Safe Media Handling (Non-Destructive)
- Every media mutation MUST create/retain a backup in `.originals` before change; re-runs must not destroy existing backups.
- Processing scope is limited to the declared working directory; unsupported files are skipped without modification.
- Transformations must respect configured bounds (images ≤1200x1200; videos ≤720p/H.264) unless an approved spec overrides them.
- Output video framerate MUST be capped at 24fps; sources above that MUST be re-encoded down (never upsampled).
Rationale: Protect user content and allow idempotent runs without data loss.

### Adapter-Isolated Tooling (zx)
- External binaries (e.g., `mogrify`, `ffmpeg`) are invoked only through zx-based adapters in `src/adapters`; core modules never shell out directly.
- Prefer maintained libraries or tool-provided flags over bespoke command strings; deviations require justification in the plan/spec.
- Adapters expose typed options, validate tool availability, and surface actionable errors; they must be trivially mockable for tests.
Rationale: Keeps core logic portable, testable, and resilient to tool changes.

### Typed Node 22 Delivery
- Runtime target is Node 22 with ESM; TypeScript remains in `strict` mode using shared configs (e.g., `@tsconfig/node22`).
- New code avoids untyped `any` and dynamic imports; public surfaces declare explicit types for inputs/outputs and errors.
- Linting/formatting is Biome-only (`npm run check` for analysis, `npm run check-fix` for safe autofix, `npm run check-fix-unsafe` only with review due to behavioral risk); do not introduce ESLint/Prettier.
- Builds use `tsdown` and emit to `dist/` only; no `build/` directory is generated or relied upon.
Rationale: Guarantees predictable behavior, consistent formatting, and compatibility with the supported runtime.

### Test-First Coverage (Vitest)
- Features and fixes land with Vitest coverage for CLI validation, media classification, adapter calls, and error paths.
- External binaries are mocked by default; integration tests that exercise real tools must be opt-in and documented.
- Tests must be deterministic (no network) and assert idempotent reruns, backup behavior, and safe handling of missing dependencies.
Rationale: Prevents regressions in media safety and adapter boundaries.

### CLI UX & Progress Transparency
- The CLI validates inputs early and fails fast with actionable messages (missing directory, unsupported file, missing tooling).
- Progress output must reflect backup and processing steps; partial failures are reported with counts and file names.
- Default processing parameters live in a single config surface; user overrides are validated before execution.
Rationale: Clear feedback builds trust and keeps batch runs debuggable.

## Technical Standards & Stack
- Stack: Node 22, TypeScript 5.9+, ESM; tsdown builds emit to `dist/` (`bin` is `dist/index.js` with shebang); avoid adding a `build/` pipeline.
- External commands run through zx in adapters; prefer well-maintained libraries over bespoke code where suitable.
- Linting/formatting: Biome is the sole tool; `npm run check` is the gate, `npm run check-fix` is allowed for safe autofix, and `npm run check-fix-unsafe` is opt-in with manual review to prevent behavior drift; do not add ESLint/Prettier.
- Media bounds default to 1200x1200 for images and 720p/H.264 for video with a 24fps output cap (downsample sources above 24fps); keep these values centralized and configurable.
- File operations are limited to the target working directory; backups live in `.originals` and must not be overwritten on rerun.

## Development Workflow & Quality Gates
- Planning includes a Constitution Check covering non-destructive handling, adapter isolation, Node 22/TypeScript compliance, media bounds (720p/H.264 with 24fps cap), test coverage, and CLI UX expectations.
- Implementation uses zx adapters for all tool invocations and documents any bespoke logic when a library was viable.
- `npm run check` and `npm run test` must pass before review; apply `npm run check-fix` for safe autofixes and use `npm run check-fix-unsafe` only when changes are reviewed for behavioral risk; reviewers verify no direct shelling out outside adapters and that tests cover error paths.
- Exceptions to principles require a recorded justification with an expiry and follow-up task to return to compliance.

## Governance
- This constitution supersedes ad hoc practices; any exception must be explicitly documented with scope and duration.
- Amendments require a PR updating this file plus impacted templates, a Sync Impact Report, and a semantic version bump.
- Versioning: MAJOR for breaking governance or principle removals; MINOR for new principles/sections or materially expanded rules; PATCH for clarifications and wording-only fixes.
- Compliance: Feature specs/plans must satisfy the Constitution Check; PR reviewers confirm adherence and reject changes that bypass adapters, testing, or safety bounds.

**Version**: 1.2.0 | **Ratified**: 2025-12-07 | **Last Amended**: 2025-12-08
