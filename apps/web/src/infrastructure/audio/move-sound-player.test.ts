import { describe, expect, it, vi } from "vitest";

import { createMoveSoundPlayer } from "./move-sound-player";

function fakeContext(overrides: Partial<Record<string, unknown>> = {}) {
  const started: number[] = [];
  const stopped: number[] = [];
  const context = {
    close: vi.fn(() => Promise.resolve()),
    connect: vi.fn(),
    createGain: vi.fn(() => ({
      connect: vi.fn(),
      gain: { exponentialRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() },
    })),
    createOscillator: vi.fn(() => ({
      connect: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
      start: vi.fn((at: number) => started.push(at)),
      stop: vi.fn((at: number) => stopped.push(at)),
      type: "sine",
    })),
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    state: "running",
    ...overrides,
  };
  return { context, started, stopped };
}

describe("createMoveSoundPlayer", () => {
  it("schedules one oscillator per tone in the cue", () => {
    const { context, started } = fakeContext();
    const player = createMoveSoundPlayer({ createContext: () => context as never });

    player.play("move");
    expect(started).toHaveLength(1);

    player.play("game-end");
    expect(started).toHaveLength(4);
  });

  it("stops every oscillator it starts", () => {
    const { context, started, stopped } = fakeContext();
    const player = createMoveSoundPlayer({ createContext: () => context as never });

    player.play("check");

    expect(stopped).toHaveLength(started.length);
    expect(stopped.every((at, index) => at > (started[index] ?? 0))).toBe(true);
  });

  it("creates the audio context lazily and only once", () => {
    const { context } = fakeContext();
    const createContext = vi.fn(() => context as never);
    const player = createMoveSoundPlayer({ createContext });

    expect(createContext).not.toHaveBeenCalled();
    player.play("move");
    player.play("capture");
    expect(createContext).toHaveBeenCalledOnce();
  });

  it("resumes a context that the browser suspended before a gesture", () => {
    const { context } = fakeContext({ state: "suspended" });
    createMoveSoundPlayer({ createContext: () => context as never }).play("move");

    expect(context.resume).toHaveBeenCalledOnce();
  });

  it("goes quiet instead of throwing when audio is unavailable", () => {
    const player = createMoveSoundPlayer({
      createContext: () => {
        throw new Error("no audio device");
      },
    });

    expect(() => {
      player.play("move");
    }).not.toThrow();
  });

  it("goes quiet after a scheduling failure rather than failing every later move", () => {
    const { context } = fakeContext({
      createOscillator: vi.fn(() => {
        throw new Error("node limit");
      }),
    });
    const createContext = vi.fn(() => context as never);
    const player = createMoveSoundPlayer({ createContext });

    player.play("move");
    player.play("move");

    expect(createContext).toHaveBeenCalledOnce();
  });

  it("closes the context on dispose and stays silent afterwards", () => {
    const { context, started } = fakeContext();
    const player = createMoveSoundPlayer({ createContext: () => context as never });

    player.play("move");
    player.dispose();
    player.play("move");

    expect(context.close).toHaveBeenCalledOnce();
    expect(started).toHaveLength(1);
  });

  it("is silent in a runtime without an AudioContext constructor", () => {
    expect(() => {
      createMoveSoundPlayer().play("move");
    }).not.toThrow();
  });
});
