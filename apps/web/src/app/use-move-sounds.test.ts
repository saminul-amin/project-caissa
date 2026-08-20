import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GameSession, MoveRecord } from "@caissa/chess-core";
import { DEFAULT_USER_PREFERENCES } from "../application/settings";
import type { MoveSoundPlayer } from "../infrastructure/audio";
import { isSoundEnabled, selectMoveSound, useMoveSounds } from "./use-move-sounds";

function move(overrides: Partial<MoveRecord> = {}): MoveRecord {
  return {
    actor: "human",
    clockAfter: { lastTimestampMs: undefined, status: "untimed", timeControl: { kind: "untimed" } },
    clockBefore: {
      lastTimestampMs: undefined,
      status: "untimed",
      timeControl: { kind: "untimed" },
    },
    fenAfter: "8/8/8/8/8/8/8/8 w - - 0 1",
    fenBefore: "8/8/8/8/8/8/8/8 w - - 0 1",
    givesCheck: false,
    givesCheckmate: false,
    mover: "white",
    ply: 1,
    san: "e4",
    uci: "e2e4",
    ...overrides,
  } as MoveRecord;
}

function session(history: readonly MoveRecord[], gameId = "game-1"): GameSession {
  return { gameId, history } as unknown as GameSession;
}

function stubPlayer() {
  const dispose = vi.fn();
  const play = vi.fn();
  const player: MoveSoundPlayer = { dispose, play };
  return { create: () => player, dispose, play };
}

describe("selectMoveSound", () => {
  it("prefers check over every other cue", () => {
    expect(selectMoveSound(move({ givesCheck: true, promotion: "queen" }))).toBe("check");
    expect(selectMoveSound(move({ givesCheckmate: true }))).toBe("check");
  });

  it("distinguishes promotions and captures from ordinary moves", () => {
    expect(selectMoveSound(move({ promotion: "queen" }))).toBe("promotion");
    expect(selectMoveSound(move({ captured: "pawn" }))).toBe("capture");
    expect(selectMoveSound(move())).toBe("move");
  });
});

describe("isSoundEnabled", () => {
  it("requires both the global and the move-sound preference", () => {
    expect(isSoundEnabled(DEFAULT_USER_PREFERENCES)).toBe(true);
    expect(isSoundEnabled({ ...DEFAULT_USER_PREFERENCES, soundEnabled: false })).toBe(false);
    expect(isSoundEnabled({ ...DEFAULT_USER_PREFERENCES, moveSoundEnabled: false })).toBe(false);
  });
});

describe("useMoveSounds", () => {
  it("stays silent on the first render so a restored game does not replay its last move", () => {
    const stub = stubPlayer();
    renderHook(() => {
      useMoveSounds(
        { preferences: DEFAULT_USER_PREFERENCES, session: session([move()]) },
        stub.create,
      );
    });

    expect(stub.play).not.toHaveBeenCalled();
  });

  it("plays exactly one cue per newly committed move", () => {
    const stub = stubPlayer();
    const { rerender } = renderHook(
      (input: { readonly session: GameSession }) => {
        useMoveSounds(
          { preferences: DEFAULT_USER_PREFERENCES, session: input.session },
          stub.create,
        );
      },
      { initialProps: { session: session([]) } },
    );

    rerender({ session: session([move()]) });
    rerender({
      session: session([move(), move({ captured: "pawn", ply: 2 as never, uci: "d2d4" as never })]),
    });

    expect(stub.play).toHaveBeenNthCalledWith(1, "move");
    expect(stub.play).toHaveBeenNthCalledWith(2, "capture");
  });

  it("does not replay a cue when the session object changes but the move does not", () => {
    const stub = stubPlayer();
    const { rerender } = renderHook(
      (input: { readonly session: GameSession }) => {
        useMoveSounds(
          { preferences: DEFAULT_USER_PREFERENCES, session: input.session },
          stub.create,
        );
      },
      { initialProps: { session: session([]) } },
    );

    rerender({ session: session([move()]) });
    rerender({ session: session([move()]) });

    expect(stub.play).toHaveBeenCalledOnce();
  });

  it("never creates a player when sound is switched off", () => {
    const create = vi.fn(() => ({ dispose: vi.fn(), play: vi.fn() }));
    const { rerender } = renderHook(
      (input: { readonly session: GameSession }) => {
        useMoveSounds(
          {
            preferences: { ...DEFAULT_USER_PREFERENCES, soundEnabled: false },
            session: input.session,
          },
          create,
        );
      },
      { initialProps: { session: session([]) } },
    );

    rerender({ session: session([move()]) });

    expect(create).not.toHaveBeenCalled();
  });

  it("resets between games so a new game does not inherit the previous cue", () => {
    const stub = stubPlayer();
    const initialProps: { readonly session: GameSession | undefined } = { session: session([]) };
    const { rerender } = renderHook(
      (input: { readonly session: GameSession | undefined }) => {
        useMoveSounds(
          { preferences: DEFAULT_USER_PREFERENCES, session: input.session },
          stub.create,
        );
      },
      { initialProps },
    );

    rerender({ session: undefined });
    rerender({ session: session([move()], "game-2") });

    expect(stub.play).not.toHaveBeenCalled();
  });

  it("disposes the player when the application unmounts", () => {
    const stub = stubPlayer();
    const { rerender, unmount } = renderHook(
      (input: { readonly session: GameSession }) => {
        useMoveSounds(
          { preferences: DEFAULT_USER_PREFERENCES, session: input.session },
          stub.create,
        );
      },
      { initialProps: { session: session([]) } },
    );

    rerender({ session: session([move()]) });
    unmount();

    expect(stub.dispose).toHaveBeenCalled();
  });
});
