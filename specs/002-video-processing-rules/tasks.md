---


description: "Task list for Video Processing Rules implementation"

---

# Tasks: Video Processing Rules

**Input**: Design documents from `/specs/002-video-processing-rules/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Include Vitest tasks where verification is critical to requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared config/constants used by all stories.

- [X] T001 Add max video fps cap and subtitle handling constants to `src/media/constants.ts`
- [X] T002 Add shared media types for inspection and decisions to `src/media/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core inspection and decision utilities required by all stories.

- [X] T003 Create ffprobe adapter for video inspection (codec/resolution/fps/metadata/tracks) in `src/adapters/ffprobe.ts`
- [X] T004 Add media inspection utility using ffprobe adapter to classify triggers in `src/media/inspect.ts`
- [X] T005 Add decision logging structures (skip/process, reasons, paths) in `src/media/processor.ts`
- [X] T006 Wire progress update type extensions (include reason/status counts) in `src/media/processor.ts` and `src/cli.ts`
- [X] T007 Add Vitest coverage for missing tool detection (`MissingToolsError`, tool checks) in `test/media/tools.test.ts`

**Checkpoint**: Inspection and decision scaffolding ready.

---

## Phase 3: User Story 1 - Skip compliant videos (Priority: P1) 🎯 MVP

**Goal**: Automatically skip compliant videos with no backups or outputs.

**Independent Test**: Running the CLI on fully compliant videos yields skipped status, zero backups, zero outputs.

### Implementation & Tests

- [X] T008 [P] [US1] Add classification unit tests for compliant vs non-compliant detection in `test/media/inspect.test.ts`
- [X] T009 [US1] Integrate inspection before backup to skip compliant videos in `src/media/processor.ts`
- [X] T010 [P] [US1] Ensure progress/log output surfaces skip reasons and counts in `src/cli.ts`
- [X] T011 [US1] Record skip decisions (status + reason) in summaries in `src/media/processor.ts`

**Checkpoint**: Compliant videos skip with no backups/outputs; logs reflect skip reasons.

---

## Phase 4: User Story 2 - Process non-compliant videos (Priority: P2)

**Goal**: Process any non-compliant or metadata-bearing video, backing up originals and emitting compliant outputs.

**Independent Test**: A video violating any rule produces a backup in `.originals` and a compliant output in the original container.

### Implementation & Tests

- [X] T012 [P] [US2] Add processing trigger tests for codec/resolution/fps/metadata in `test/media/processor.test.ts`
- [X] T013 [US2] Expand inspection to surface metadata/trigger flags consumed by processing decisions in `src/media/inspect.ts`
- [X] T014 [US2] Ensure backups occur only when processing and are deduped on reruns in `src/media/processor.ts`
- [X] T015 [US2] Implement processing pipeline for H.264 outputs with resolution/fps caps and metadata stripping in `src/adapters/ffmpeg.ts`
- [X] T016 [P] [US2] Add adapter tests verifying caps and metadata stripping in `test/media/ffmpeg-adapter.test.ts`

**Checkpoint**: Non-compliant videos backed up and re-encoded to compliant outputs with metadata removed.

---

## Phase 5: User Story 3 - Preserve audio and container identity (Priority: P3)

**Goal**: Outputs retain original container and audio while meeting video rules; text subtitles kept, binary attachments dropped; reruns idempotent.

**Independent Test**: Processed outputs keep container/extension and all audio tracks with sync; text subtitles preserved; binary/attachment tracks absent; reruns create no extra backups.

### Implementation & Tests

- [X] T017 [P] [US3] Add tests for container preservation, audio track retention, and subtitle attachment dropping in `test/media/ffmpeg-adapter.test.ts`
- [X] T018 [US3] Update ffmpeg adapter to preserve all audio tracks, keep container/extension, and drop binary/attachment/data tracks while re-encoding video in `src/adapters/ffmpeg.ts`
- [X] T019 [US3] Enforce rerun idempotence (no duplicate backups or reprocessing of compliant outputs) in `src/media/processor.ts`
- [X] T020 [US3] Extend decision summaries to include processed outputs and triggers in `src/media/processor.ts`

**Checkpoint**: Outputs preserve container/audio/subtitles as required; reruns are safe and idempotent.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T021 [P] Update quickstart to reflect new skip/process rules and prerequisites in `specs/002-video-processing-rules/quickstart.md`
- [X] T022 Run `npm run check && npm test` and note results in `specs/002-video-processing-rules/plan.md`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → User Stories (US1 then US2 then US3) → Polish.
- User stories are prioritized P1 → P2 → P3; each depends on Foundational completion.

### User Story Dependency Graph

- US1 (skip compliant) → US2 (process non-compliant) → US3 (preserve audio/container)

### Parallel Opportunities

- Marked [P] tasks can run concurrently (e.g., tests alongside implementation in different files).
- After Foundational, US1/US2/US3 can proceed sequentially by priority; within a story, [P] tasks can parallelize where files do not conflict.

## Implementation Strategy

- Deliver MVP by completing US1 first (skip path and logging).
- Extend to US2 for full processing and backups.
- Finalize with US3 for audio/container/subtitle preservation and idempotent reruns.
