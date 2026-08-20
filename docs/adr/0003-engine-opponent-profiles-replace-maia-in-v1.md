# ADR-0003 — Engine Opponent Profiles Replace Maia in Version 1

**Status:** Accepted
**Date:** 2026-08-19
**Amends:** `04_technical_specification.md` §12, `06_ai_architecture.md` §9, roadmap Phase 7

## Context

The approved design puts human-like opposition behind a remote Maia-3 service
(`apps/maia-service`). That service cannot be part of a Version 1 itch.io release:

- itch.io HTML5 projects are static; there is no backend to call.
- A remote opponent contradicts the local-first and offline promises in the PRD.
- The service needs paid hosting, uptime, and AGPL network-source compliance for a
  project with no revenue.
- Shipping it would make every engine game fail whenever the service is down.

Version 1 still needs an opponent that is enjoyable across a range of strengths.

## Decision

Version 1 ships opponent profiles backed by the bundled local engine. Six profiles
(`newcomer` through `maximum`) configure Stockfish skill level, `UCI_Elo` strength
limiting, and a bounded search time, plus a short varied pause so replies do not feel
mechanical.

Profiles are named as experiences, never as ratings. Every screen that offers them carries
`OPPONENT_STRENGTH_DISCLOSURE`: strength names describe engine settings, not human ratings.
This satisfies the honesty requirement in `06_ai_architecture.md` §12.2 more directly than
a rating label would.

The `OpponentProvider` port in `apps/web/src/application/opponent` is provider-agnostic. A
Maia-backed provider can be added later behind the same port with no change to the game
controller, the coordinator, or any screen.

`apps/maia-service` remains in the repository as an unreleased health-only service.

## Alternatives

- Ship Maia as a required remote dependency: rejected; breaks offline play and itch.io.
- Ship Maia as an optional online opponent: deferred; adds an operational surface that
  Version 1 cannot support.
- Ship no opponent: rejected; the product is not playable alone without one.

## Consequences

- Engine games work fully offline after the first load.
- Caissa does not claim human-like move distributions in Version 1, and no copy implies it.
- The Maia workstream moves to Version 2 with the port boundary already in place.
