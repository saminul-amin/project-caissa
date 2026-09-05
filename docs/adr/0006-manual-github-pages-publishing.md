# ADR-0006 — Manual Publishing to GitHub Pages

**Status:** Accepted
**Date:** 2026-09-05

## Context

Caissa has no backend, so the production build can be served as static files. GitHub Pages
is the natural host for the repository, but the account cannot spend GitHub Actions minutes,
so the usual "deploy on push" workflow is unavailable. The application already builds with a
relative base and hash routes (ADR-0005), which means the same artefact works at a domain
root, under a project subpath such as `/project-caissa/`, and inside the itch.io iframe.

## Decision

The site is published from a `gh-pages` branch by a documented manual script,
`scripts/publish-pages.mjs` (`pnpm publish:pages`). The script refuses to run from a dirty
tree, runs the full `pnpm verify` gate, copies `apps/web/dist` onto the branch through a
temporary git worktree, adds `.nojekyll`, records the source commit in the publish commit
message, and pushes. GitHub Pages serves the branch root.

## Alternatives

- GitHub Actions deployment: rejected; no Actions minutes are available.
- Committing `dist` to `main`: rejected; `pnpm artifacts:check` forbids tracked build output,
  and it would double every diff.
- A third-party static host: rejected; it adds an account and a dependency for no benefit.

## Consequences

- Publishing is deliberate and traceable, never accidental.
- The live site can lag `main` until someone runs the script; the README says so.
- The published bytes are the ones the quality gate verified, because the script builds and
  publishes in one run.
