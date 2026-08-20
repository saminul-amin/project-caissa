# ADR-0005 — Hash Routing for Static Hosting

**Status:** Accepted
**Date:** 2026-08-19

## Context

Caissa is deployed as static files, including inside an itch.io iframe served from a path
that the project does not control. History-API routes require the host to rewrite unknown
paths to `index.html`. itch.io does not do this, so a refresh or a direct link to `/play`
would 404.

## Decision

The application uses `HashRouter`, and Vite builds with `base: "./"`. Every asset URL,
including the engine worker script, resolves relative to the document.

## Alternatives

- `BrowserRouter` with a host rewrite rule: rejected; unavailable on itch.io.
- A single route with in-app view state: rejected; loses linkability and browser history.

## Consequences

- URLs contain `#`, which is acceptable for a game and required by the host.
- The same build works at a domain root, in a subdirectory, and inside an iframe with no
  configuration change.
