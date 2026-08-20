export type MoveSoundKind = "capture" | "check" | "game-end" | "move" | "promotion";

export interface MoveSoundPlayer {
  dispose(): void;
  play(kind: MoveSoundKind): void;
}

interface ToneSpec {
  readonly attackMs: number;
  readonly frequencyHz: number;
  readonly gain: number;
  readonly releaseMs: number;
  readonly startOffsetMs: number;
  readonly type: OscillatorType;
}

/**
 * Every sound is synthesised at runtime.
 *
 * Bundling audio files would add licensing obligations and megabytes to an itch.io
 * package for a handful of short cues, so Caissa generates them from oscillators instead.
 */
const TONES: Readonly<Record<MoveSoundKind, readonly ToneSpec[]>> = Object.freeze({
  capture: [
    {
      attackMs: 2,
      frequencyHz: 220,
      gain: 0.16,
      releaseMs: 110,
      startOffsetMs: 0,
      type: "triangle",
    },
    { attackMs: 2, frequencyHz: 146, gain: 0.1, releaseMs: 90, startOffsetMs: 24, type: "sine" },
  ],
  check: [
    { attackMs: 2, frequencyHz: 660, gain: 0.12, releaseMs: 90, startOffsetMs: 0, type: "sine" },
    { attackMs: 2, frequencyHz: 880, gain: 0.1, releaseMs: 110, startOffsetMs: 70, type: "sine" },
  ],
  "game-end": [
    { attackMs: 4, frequencyHz: 392, gain: 0.12, releaseMs: 190, startOffsetMs: 0, type: "sine" },
    { attackMs: 4, frequencyHz: 523, gain: 0.11, releaseMs: 220, startOffsetMs: 120, type: "sine" },
    { attackMs: 4, frequencyHz: 659, gain: 0.1, releaseMs: 320, startOffsetMs: 240, type: "sine" },
  ],
  move: [
    { attackMs: 2, frequencyHz: 392, gain: 0.11, releaseMs: 80, startOffsetMs: 0, type: "sine" },
  ],
  promotion: [
    { attackMs: 3, frequencyHz: 523, gain: 0.12, releaseMs: 120, startOffsetMs: 0, type: "sine" },
    { attackMs: 3, frequencyHz: 784, gain: 0.1, releaseMs: 160, startOffsetMs: 90, type: "sine" },
  ],
});

export interface CreateMoveSoundPlayerOptions {
  /** Injected in tests; defaults to the browser constructor when one exists. */
  readonly createContext?: () => AudioContext;
}

export function createMoveSoundPlayer(options: CreateMoveSoundPlayerOptions = {}): MoveSoundPlayer {
  const createContext = options.createContext ?? defaultContextFactory();
  let context: AudioContext | undefined;
  let unavailable = createContext === undefined;

  function ensureContext(): AudioContext | undefined {
    if (unavailable || !createContext) return undefined;
    try {
      context ??= createContext();
      // Browsers start audio suspended until a gesture; resuming here is a no-op otherwise.
      if (context.state === "suspended") void context.resume();
      return context;
    } catch {
      unavailable = true;
      return undefined;
    }
  }

  return Object.freeze({
    dispose() {
      unavailable = true;
      const active = context;
      context = undefined;
      try {
        void active?.close();
      } catch {
        /* Closing a already-closed context must never surface to the player. */
      }
    },

    play(kind: MoveSoundKind) {
      const active = ensureContext();
      if (!active) return;

      try {
        for (const tone of TONES[kind]) {
          const startAt = active.currentTime + tone.startOffsetMs / 1_000;
          const attackEnd = startAt + tone.attackMs / 1_000;
          const endAt = attackEnd + tone.releaseMs / 1_000;

          const oscillator = active.createOscillator();
          const amplifier = active.createGain();
          oscillator.type = tone.type;
          oscillator.frequency.setValueAtTime(tone.frequencyHz, startAt);
          amplifier.gain.setValueAtTime(0.000_1, startAt);
          amplifier.gain.exponentialRampToValueAtTime(tone.gain, attackEnd);
          amplifier.gain.exponentialRampToValueAtTime(0.000_1, endAt);

          oscillator.connect(amplifier);
          amplifier.connect(active.destination);
          oscillator.start(startAt);
          oscillator.stop(endAt);
        }
      } catch {
        unavailable = true;
      }
    },
  });
}

function defaultContextFactory(): (() => AudioContext) | undefined {
  if (typeof AudioContext !== "function") return undefined;
  return () => new AudioContext();
}
