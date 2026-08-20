import type { RequestIdFactory } from "../../application/opponent";

export interface RandomUuidSource {
  randomUUID(): string;
}

/** Opponent request identifiers must be unguessable per request so stale results cannot be replayed. */
export class BrowserRequestIdGenerator implements RequestIdFactory {
  constructor(private readonly source: RandomUuidSource = crypto) {}

  create(): string {
    return `req-${this.source.randomUUID()}`;
  }
}
