# Base technologies used
- Node.js
- TypeScript for Code
- tsdown for bundling
- biome for code formatting and linting
- vitest for testing
- zx for calling other non-JS tools from our code

# General rules regarding libraries and frameworks
- Important: Favor using existing libraries / frameworks over implementing stuff locally.
- Resolve library IDs with the Context7 MCP tool before fetching documentation.
- Retrieve docs through Context7 for any code generation, setup, or API/library reference needs.

# Project structure
- `src/`: source code and test code
- `fixtures/`: a few example images and videos that can be used for testing - do not modify those
- `dist/`: the compiled .js code - do not modify as this is auto-generated from the source code

# npm scripts
- `npm run build`: compile TypeScript to .js in the `dist/` folder
- `npm run check`: check for lint and formatting errors using biome
- `npm run test`: run tests

# Code style
- Whenever you think a task is finished, use `npm run check`

# Documentation
- Write all documentation in English; keep this file current when scripts or heuristics change.
- Use concise, explanatory comments only where the code genuinely needs clarification.
- For any substantive script or heuristic change, review/update this `AGENTS.md` file.
- Maintain the current iteration plan in `PLAN.md`, updating it after each planning cycle or implementation change.
- Keep `PLAN.md` in the enforced format: `Status` + `Open items` (current TODOs) + `Done recently` (≤5 entries). Prune
  older done items; update PLAN when tasks are completed (move from Open → Done).

# Calling non-JS tools via zx
- All calls to external tools like `ffmpeg` via zx should be wrapped in dedicated adapter functions.
- This way, most of the codebase is not coupled to zx or the external tools.
- This greatly improves testability, as well.

# Commit guidelines
- History is light; adopt Conventional Commits (e.g., `feat: add video downscaling`, `fix: handle metadata`).
- Do not push to remote repositories.
