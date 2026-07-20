import type { GameController, GameSession, SessionRevision } from "@caissa/chess-core";

import {
  PersistenceValidationError,
  type CompletedGameRecord,
  type EpochTimestampMs,
} from "../persistence";

export interface BuildCompletedGameRecordOptions {
  readonly completedAt: EpochTimestampMs;
  readonly controller: GameController;
  readonly startedAt?: EpochTimestampMs;
}

export interface CompletedGameRecordBuildMetadata {
  readonly blackParticipantKind: GameSession["configuration"]["participants"]["black"]["kind"];
  readonly opponentSummary: Readonly<{
    readonly blackKind: GameSession["configuration"]["participants"]["black"]["kind"];
    readonly whiteKind: GameSession["configuration"]["participants"]["white"]["kind"];
  }>;
  readonly revision: SessionRevision;
  readonly timeControl: GameSession["configuration"]["timeControl"];
  readonly whiteParticipantKind: GameSession["configuration"]["participants"]["white"]["kind"];
}

export interface BuiltCompletedGameRecord {
  readonly metadata: CompletedGameRecordBuildMetadata;
  readonly record: CompletedGameRecord;
}

/** Builds application data only; infrastructure owns durable storage-record projection. */
export function buildCompletedGameRecord(
  options: BuildCompletedGameRecordOptions,
): BuiltCompletedGameRecord {
  const session = options.controller.getSession();
  if (
    (session.lifecycle.phase !== "completed" && session.lifecycle.phase !== "abandoned") ||
    !session.result
  ) {
    throw new PersistenceValidationError("A terminal game session and result are required.");
  }

  const checkpoint = options.controller.exportCheckpoint();
  const pgn = options.controller.exportPgn();
  const participants = session.configuration.participants;
  const record: CompletedGameRecord = Object.freeze({
    checkpoint,
    completedAt: options.completedAt,
    gameId: session.gameId,
    pgn,
    result: session.result,
    ...(options.startedAt === undefined ? {} : { startedAt: options.startedAt }),
  });
  const opponentSummary = Object.freeze({
    blackKind: participants.black.kind,
    whiteKind: participants.white.kind,
  });

  return Object.freeze({
    metadata: Object.freeze({
      blackParticipantKind: participants.black.kind,
      opponentSummary,
      revision: session.revision,
      timeControl: session.configuration.timeControl,
      whiteParticipantKind: participants.white.kind,
    }),
    record,
  });
}
