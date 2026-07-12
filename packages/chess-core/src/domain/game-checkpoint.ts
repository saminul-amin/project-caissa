import type { ClockState } from "./clock";
import type { GameLifecycleState } from "./game-lifecycle";
import type { GameResult } from "./game-result";
import type {
  GameConfiguration,
  GameSession,
  MoveRecord,
  OpponentRequestState,
  PositionSnapshot,
} from "./game-session";
import { freezeGameSessionSnapshot } from "./game-snapshot";
import type { GameId, SessionRevision } from "./primitives";

export const GAME_SESSION_CHECKPOINT_VERSION = 1 as const;
export type GameSessionCheckpointVersion = typeof GAME_SESSION_CHECKPOINT_VERSION;

/** Storage-independent domain data. Persistence adapters will own serialization and migrations. */
export interface GameSessionCheckpoint {
  readonly activeOpponentRequest: OpponentRequestState | undefined;
  readonly checkpointVersion: GameSessionCheckpointVersion;
  readonly clock: ClockState;
  readonly configuration: GameConfiguration;
  readonly gameId: GameId;
  readonly history: readonly MoveRecord[];
  readonly lifecycle: GameLifecycleState;
  readonly position: PositionSnapshot;
  readonly result: GameResult | undefined;
  readonly revision: SessionRevision;
}

export function createGameSessionCheckpoint(session: GameSession): GameSessionCheckpoint {
  const snapshot = freezeGameSessionSnapshot(session);
  return Object.freeze({
    activeOpponentRequest: snapshot.activeOpponentRequest,
    checkpointVersion: GAME_SESSION_CHECKPOINT_VERSION,
    clock: snapshot.clock,
    configuration: snapshot.configuration,
    gameId: snapshot.gameId,
    history: snapshot.history,
    lifecycle: snapshot.lifecycle,
    position: snapshot.position,
    result: snapshot.result,
    revision: snapshot.revision,
  });
}
