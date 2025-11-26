Status
- Optional CLI path default implemented; docs updated

Open items
- (none)

Done recently
- Repaired CLI test to align with new logging behavior.
- Made CLI path argument optional with current working directory fallback; updated validation, tests, and README.
- Added fixture download helper script and npm command (skips existing files).
- Prepared infrastructure/config (added build/test scripts, tsdown + vitest configs, updated tsconfig includes).
- Installed fixed-version runtime deps (commander, fast-glob, zx).
- Scaffolded `src/` and `test/` with CLI entry, adapters, media modules, and initial test.
