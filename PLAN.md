Status
- Initial media processing flow implemented; no open items.

Open items
- (none)

Done recently
- Added workingDir validation in the CLI with clear errors and default cwd fallback.
- Limited file discovery to top-level files and added classification with dispatch to per-type handlers.
- Implemented handlers (image backup + mogrify call, video placeholder log, other no-op) and covered them with tests.
- Repaired CLI test to align with new logging behavior.
- Made CLI path argument optional with current working directory fallback; updated validation, tests, and README.
- Added fixture download helper script and npm command (skips existing files).
- Prepared infrastructure/config (added build/test scripts, tsdown + vitest configs, updated tsconfig includes).
- Installed fixed-version runtime deps (commander, fast-glob, zx).
- Scaffolded `src/` and `test/` with CLI entry, adapters, media modules, and initial test.
