import type { GameResult } from "./game-result";
import type {
  MoveRecord,
  OpponentRequestFailureReason,
  OpponentRequestState,
} from "./game-session";
import type { ResumableGamePhase } from "./game-lifecycle";
import type { Color, GameId, RequestId, SessionRevision } from "./primitives";

interface GameEventBase {
  readonly gameId: GameId;
  readonly revision: SessionRevision;
}

export type GameDomainEvent =
  | (GameEventBase & {
      readonly activeColor: Color;
      readonly type: "game-started";
    })
  | (GameEventBase & {
      readonly request: OpponentRequestState;
      readonly type: "opponent-move-requested";
    })
  | (GameEventBase & {
      readonly move: MoveRecord;
      readonly type: "move-committed";
    })
  | (GameEventBase & {
      readonly expiredColor: Color;
      readonly type: "clock-expired";
    })
  | (GameEventBase & {
      readonly result: GameResult;
      readonly type: "game-completed";
    })
  | (GameEventBase & {
      readonly resumePhase: ResumableGamePhase;
      readonly type: "game-paused";
    })
  | (GameEventBase & {
      readonly resumedPhase: ResumableGamePhase;
      readonly type: "game-resumed";
    })
  | (GameEventBase & {
      readonly reason: OpponentRequestFailureReason;
      readonly requestId: RequestId;
      readonly type: "opponent-request-failed";
    })
  | (GameEventBase & {
      readonly reason: OpponentRequestFailureReason;
      readonly type: "game-entered-degraded-mode";
    })
  | (GameEventBase & {
      readonly result: GameResult;
      readonly type: "game-abandoned";
    });
