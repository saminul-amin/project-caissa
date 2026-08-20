import { useEffect, useRef } from "react";
import type { GameSession, MoveRecord } from "@caissa/chess-core";

import type { UserPreferences } from "../application";
import {
  createMoveSoundPlayer,
  type MoveSoundKind,
  type MoveSoundPlayer,
} from "../infrastructure/audio";

export interface MoveSoundInput {
  readonly preferences: UserPreferences;
  readonly session: GameSession | undefined;
}

/** Chooses the cue for a committed move; the most notable event wins. */
export function selectMoveSound(move: MoveRecord): MoveSoundKind {
  if (move.givesCheckmate || move.givesCheck) return "check";
  if (move.promotion !== undefined) return "promotion";
  if (move.captured !== undefined) return "capture";
  return "move";
}

export function isSoundEnabled(preferences: UserPreferences): boolean {
  return preferences.soundEnabled && preferences.moveSoundEnabled;
}

/**
 * Plays one cue per newly committed move.
 *
 * The player is created lazily and only after a move exists, so a visitor who never
 * starts a game never constructs an audio context.
 */
export function useMoveSounds(
  { preferences, session }: MoveSoundInput,
  createPlayer: () => MoveSoundPlayer = createMoveSoundPlayer,
): void {
  const playerRef = useRef<MoveSoundPlayer | undefined>(undefined);
  const lastSignature = useRef<string | undefined>(undefined);

  useEffect(
    () => () => {
      playerRef.current?.dispose();
      playerRef.current = undefined;
    },
    [],
  );

  useEffect(() => {
    if (!session) {
      lastSignature.current = undefined;
      return;
    }

    const move = session.history.at(-1);
    const signature = `${String(session.gameId)}:${String(session.history.length)}:${move ? String(move.uci) : "none"}`;
    const previous = lastSignature.current;
    lastSignature.current = signature;

    if (previous === undefined || previous === signature || !move) return;
    if (!isSoundEnabled(preferences)) return;

    playerRef.current ??= createPlayer();
    playerRef.current.play(selectMoveSound(move));
  }, [createPlayer, preferences, session]);
}
