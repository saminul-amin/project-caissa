export type DomainValidationErrorCode =
  | "invalid-clock-duration"
  | "invalid-clock-increment"
  | "invalid-color"
  | "invalid-fen"
  | "invalid-game-id"
  | "invalid-pgn"
  | "invalid-ply"
  | "invalid-request-id"
  | "invalid-san"
  | "invalid-session-revision"
  | "invalid-square"
  | "invalid-monotonic-timestamp"
  | "invalid-uci";

/** A malformed value encountered at the chess-domain trust boundary. */
export class DomainValidationError extends Error {
  readonly code: DomainValidationErrorCode;

  constructor(code: DomainValidationErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DomainValidationError";
    this.code = code;
  }
}

/** An unexpected failure behind the chess-rules adapter boundary. */
export class ChessRulesAdapterError extends Error {
  readonly code = "chess-rules-adapter-failure" as const;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ChessRulesAdapterError";
  }
}

export type GameControllerErrorCode =
  "controller-invariant-failure" | "invalid-game-configuration" | "move-rollback-failed";

/** A typed unexpected failure inside the authoritative game-controller boundary. */
export class GameControllerError extends Error {
  readonly code: GameControllerErrorCode;

  constructor(code: GameControllerErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GameControllerError";
    this.code = code;
  }
}
