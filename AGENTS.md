# bloggymedia Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-08

## Active Technologies
- Local filesystem only (`.originals` backups plus optimized outputs) (001-media-cli)
- TypeScript 5.9 on Node 22 (ESM, strict) + zx adapters for `mogrify`/`ffmpeg`, fast-glob for flat scan, tsdown, Biome (001-media-cli)

## Project Structure

```text
src/
tests/
```

## Commands

npm run check && npm test

## Code Style

TypeScript 5.9 on Node 22 (ESM, strict): Follow standard conventions; Biome-only lint/format

## Recent Changes
- 001-media-cli: Added TypeScript 5.9 on Node 22 (ESM, strict) + zx adapters for `mogrify`/`ffmpeg`, fast-glob for flat scan, tsdown, Biome

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
