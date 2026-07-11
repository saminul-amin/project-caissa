# Repository Scripts

- `check-architecture.mjs` enforces source-level dependency boundaries before dependency graph validation.
- `check-secrets.mjs` scans tracked source for high-confidence secret formats, with a filesystem fallback before Git initialization.
- `check-artifacts.mjs` rejects generated build, coverage, environment, and cache output when tracked by Git.

These scripts use only Node built-ins and run through root pnpm commands.
