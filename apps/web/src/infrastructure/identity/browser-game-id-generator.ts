import { parseGameId, type GameId } from "@caissa/chess-core";

import type { GameIdGenerator } from "../../application/game-creation";

export interface RandomUuidSource {
  randomUUID(): string;
}

export class BrowserGameIdGenerator implements GameIdGenerator {
  constructor(private readonly source: RandomUuidSource = crypto) {}

  create(): GameId {
    return parseGameId(this.source.randomUUID());
  }
}
