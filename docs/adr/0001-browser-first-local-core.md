# ADR-0001 — Browser-First Local Core

**Status:** Accepted
**Date:** 2026-08-19
**Supersedes:** none

## Context

Caissa must be playable on itch.io, offline, and without accounts. A server-authoritative
game would break every one of those constraints and would add hosting cost and operational
risk to a project that has no revenue model.

## Decision

The browser owns authoritative game state. `packages/chess-core` holds the rules, clock,
lifecycle, and result logic with no framework or browser dependency. Persistence is local
IndexedDB through Dexie. No server participates in a game.

## Alternatives

- Server-authoritative games: rejected; incompatible with offline play and itch.io.
- Hybrid validation: rejected; duplicates rules and creates two sources of truth.

## Consequences

- Play works with no network after first load.
- Anti-cheat is impossible, which Version 1 accepts because there is no ranking.
- Data loss is a browser-storage concern; recovery and export exist for that reason.
