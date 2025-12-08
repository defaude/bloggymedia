# Research - Bloggymedia CLI Experience (2025-12-07)

## Unknowns resolved

### Performance Goals
- **Decision**: Target responsive UX over raw throughput: immediate greeting, per-file progress updates, and completion summary; no strict p95, but avoid perceptible idle gaps between files.
- **Rationale**: CLI runs locally on blog-sized folders where user feedback matters more than bulk speed; external tools dominate runtime.
- **Alternatives considered**: Enforce numeric p95 (rejected: tool- and hardware-dependent); add concurrency (rejected: increases complexity and risk for file I/O without demonstrated need).

### Scale/Scope
- **Decision**: Optimize for flat folders of tens to low hundreds of media files (typical blogging sets); very large batches are out of scope for now.
- **Rationale**: Spec mandates flat-folder processing and skipping subdirectories; blog workflows rarely exceed this size, keeping UX simple.
- **Alternatives considered**: Support thousands of files with batching/concurrency (rejected: beyond spec scope and would require different progress/reporting strategy).

## Dependency and tooling notes

### zx adapters for `mogrify` and `ffmpeg`
- **Decision**: Keep all external tool calls in `src/adapters` with typed options and upfront tool availability check.
- **Rationale**: Matches constitution (adapter isolation), improves testability and error surfacing.
- **Alternatives considered**: Inline shell calls in core (rejected: violates constitution and hinders testing).

### `fast-glob` usage
- **Decision**: Use `fast-glob` limited to the target directory (no recursion) with explicit extensions for supported media types.
- **Rationale**: Ensures flat-folder scope and avoids unintended subdirectory traversal.
- **Alternatives considered**: `fs.readdir` manual filtering (rejected: more boilerplate; `fast-glob` already present and reliable).

### Missing tools handling
- **Decision**: Fail fast before processing if required tools are missing; surface missing tool names and exit non-zero.
- **Rationale**: Prevents partial/uncertain runs and aligns with UX transparency principle.
- **Alternatives considered**: Partial processing with available tools (rejected: inconsistent outcomes); interactive install prompts (rejected: slows automation/CI).
