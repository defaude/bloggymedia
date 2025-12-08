# Tasks: Bloggymedia CLI Experience

**Input**: Design documents from `/specs/001-media-cli/`  
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md  
**Tests**: Vitest coverage is required by the constitution (CLI behavior, adapter interactions, media bounds, missing tools, progress/summary).  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Constitution Alignment

- Preserve originals in `.originals`, never overwrite backups on rerun; flat target directory only.
- Use zx-based adapters in `src/adapters` for `mogrify`/`ffmpeg`; no direct shelling in core.
- Code style/lint is Biome-only; gate on `npm run check`, use `npm run check-fix` for safe autofix, flag any `npm run check-fix-unsafe` runs for review; tsdown builds emit to `dist/` (no `build/` folder).
- Enforce media bounds: images ≤1200px with metadata removed; videos H.264 ≤720p with metadata removed.
- Fail fast when required tools are missing; process sequentially for predictable progress.
- CLI must show progress and final summaries with counts and filenames (no full paths).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline project docs and build wiring

- [X] T001 Ensure quickstart lists prerequisites and Biome/tsdown commands (specs/001-media-cli/quickstart.md)
- [X] T002 Confirm package.json CLI bin/shebang and tsdown dist output (package.json)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Define media constants (bounds, supported extensions, flat-scope paths) in src/media/constants.ts
- [X] T004 Implement upfront tool availability check (mogrify, ffmpeg) with clear errors and non-zero exit in src/media/processor.ts
- [X] T005 Implement flat-directory discovery helper (ignore subdirs/non-media, skip existing backups) in src/media/filesystem.ts
- [X] T006 Add reusable flat-folder fixtures (images, videos, non-media, existing backups) in fixtures/
- [X] T007 Add test working-dir helper to copy fixtures per test run without mutation in test/helpers/workdir.ts
- [X] T008 [P] Add Vitest adapter tests for mogrify (metadata stripping, 1200px bound) in test/adapters.test.ts
- [X] T009 [P] Add Vitest adapter tests for ffmpeg (720p bound, metadata removal, orientation) and missing-tool fail-fast path in test/adapters.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Optimize current folder (Priority: P1) 🎯 MVP

**Goal**: Default `bloggymedia` run on current directory backs up media to `.originals`, optimizes images/videos with bounds and metadata removal, skips files with existing backups, ignores subdirectories/non-media, and runs sequentially.

**Independent Test**: Run `node dist/index.js` in a flat folder containing mixed media/non-media plus some preexisting `.originals` files; verify backups, optimized outputs, skips, and no changes outside target folder.

### Tests for User Story 1

- [X] T010 [P] [US1] Add Vitest for default run (CWD) with mixed media/non-media and existing backups in test/cli.test.ts

### Implementation for User Story 1

- [X] T011 [US1] Wire CLI default target to current working directory with validation in src/cli.ts
- [X] T012 [US1] Ensure discovery uses flat-scope helper and skips existing backups before processing in src/media/filesystem.ts
- [X] T013 [US1] Implement `.originals` backup creation and skip-if-backup-exists logic in src/media/processor.ts
- [X] T014 [P] [US1] Implement image optimization (strip metadata, cap longest side at 1200px) via mogrify adapter in src/media/processor.ts
- [X] T015 [P] [US1] Implement video optimization (strip metadata, H.264 ≤720p, preserve orientation) via ffmpeg adapter in src/media/processor.ts
- [X] T016 [US1] Enforce sequential processing loop and reconcile processed/skipped/failed counts in src/media/processor.ts

**Checkpoint**: User Story 1 fully functional and testable independently

---

## Phase 4: User Story 2 - Target a specific path (Priority: P2)

**Goal**: Allow targeting a specified folder path while keeping processing scoped to that flat directory only.

**Independent Test**: Run `node dist/index.js /path/to/media` with valid and invalid paths; verify only that folder is processed, subdirectories ignored, errors surfaced for invalid paths.

### Tests for User Story 2

- [X] T017 [P] [US2] Add Vitest for target path parsing/validation (valid folder, invalid path) in test/cli.test.ts

### Implementation for User Story 2

- [X] T018 [US2] Add optional target path argument parsing with default fallback to CWD in src/cli.ts
- [X] T019 [US2] Add target path existence/flat-scope validation and error messaging in src/media/filesystem.ts

**Checkpoint**: User Stories 1 AND 2 functional and independently testable

---

## Phase 5: User Story 3 - Understand status and outcomes (Priority: P3)

**Goal**: Provide live progress and a clear completion summary with counts and filenames (no full paths), continuing past per-file failures.

**Independent Test**: Run against mixed media with an intentional failure; observe live progress (current file, counts, errors) and final summary with processed/skipped/failed counts and filenames only.

### Tests for User Story 3

- [X] T020 [P] [US3] Add Vitest for progress output and final summary counts/filenames (including failed file) in test/cli.integration.test.ts

### Implementation for User Story 3

- [X] T021 [US3] Implement live progress display (current filename, processed/skipped/failed/remaining counts, surfaced errors) in src/cli.ts
- [X] T022 [US3] Implement final summary showing processed/skipped/failed counts and filenames only in src/cli.ts
- [X] T023 [US3] Log per-file errors, continue processing, and include failures in summary in src/media/processor.ts

**Checkpoint**: All user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T024 [P] Update README.md to note flat-scope processing, sequential runs, backup skipping, and metadata removal expectations in README.md
- [ ] T025 [P] Add troubleshooting notes for missing tools and skipped files to specs/001-media-cli/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) → Foundational (Phase 2) → User Stories (Phase 3–5) → Polish (Phase 6)
- User stories proceed in priority order (P1 → P2 → P3) after Foundational completes

### User Story Dependencies

- US1 (P1): Depends on Foundational; no other story dependencies
- US2 (P2): Depends on Foundational; independent of US1 except shared helpers
- US3 (P3): Depends on Foundational; consumes outputs from US1/US2 behaviors but remains independently testable

### Within Each User Story

- Tests should be authored before implementations
- Discovery/validation before processing; backups before optimization
- Image/video optimization can proceed in parallel once backups are in place
- Summary/progress wiring follows processing logic

### Parallel Opportunities

- Marked [P] tasks across Foundational (T008, T009) can run concurrently; T003–T007 are serial with shared helpers.
- Within US1, T014/T015 can run in parallel after T013.
- Tests marked [P] (T010, T017, T020) can run independently of implementation tasks.
- US2 and US3 workstreams can proceed in parallel after Foundational if staffing allows, respecting shared file touch points.

---

## Parallel Examples

```bash
# User Story 1: Parallelizable once backups exist
T014 [P] [US1] Implement image optimization in src/media/processor.ts
T015 [P] [US1] Implement video optimization in src/media/processor.ts

# User Story 2: Test authoring before wiring argument parsing
T017 [P] [US2] Add Vitest for target path parsing/validation in test/cli.test.ts

# User Story 3: Progress/summary test while wiring output handling
T020 [P] [US3] Add Vitest for progress output and final summary in test/cli.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo (MVP)
3. Add User Story 2 → Test independently → Demo
4. Add User Story 3 → Test independently → Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
