export interface ClockDomainFixture {
  readonly description: string;
  readonly expected: string;
  readonly id: string;
  readonly purpose: string;
}

export const clockFixtures = {
  untimed: {
    id: "untimed-clock",
    purpose: "Verify that no-clock games remain distinguishable and never expire.",
    description: "An untimed game with no remaining-time balances.",
    expected: "Lifecycle operations are immutable no-ops and no color expires.",
    timeControl: { kind: "untimed" },
  },
  fiveMinuteSuddenDeath: {
    id: "five-minute-sudden-death",
    purpose: "Verify a timed game without increment.",
    description: "Both colors receive exactly five minutes.",
    expected: "Each color starts with 300000 ms and committed moves add no time.",
    timeControl: { initialMs: 300_000, kind: "sudden-death" },
  },
  threeMinuteTwoSecondIncrement: {
    id: "three-minute-two-second-increment",
    purpose: "Verify Fischer increment after a move completed before expiration.",
    description: "Both colors receive three minutes and two seconds per completed move.",
    expected: "A successful mover receives 2000 ms after elapsed time is charged.",
    timeControl: { incrementMs: 2_000, initialMs: 180_000, kind: "increment" },
  },
  runningWhite: {
    id: "running-white-clock",
    purpose: "Verify elapsed time is charged only to White while White is active.",
    description: "A five-minute clock started for White at monotonic timestamp 1000.",
    expected: "A snapshot at 4000 leaves White 297000 ms and Black 300000 ms.",
    activeColor: "white",
    snapshotAtMs: 4_000,
    startAtMs: 1_000,
  },
  runningBlack: {
    id: "running-black-clock",
    purpose: "Verify elapsed time is charged only to Black while Black is active.",
    description: "A five-minute clock started for Black at monotonic timestamp 5000.",
    expected: "A snapshot at 9000 leaves Black 296000 ms and White 300000 ms.",
    activeColor: "black",
    snapshotAtMs: 9_000,
    startAtMs: 5_000,
  },
  pausedFromWhite: {
    id: "paused-from-white",
    purpose: "Verify a paused clock remembers that White must resume.",
    description: "White runs for 2500 ms before the clock is paused.",
    expected: "White resumes later without the paused duration being charged.",
    activeColor: "white",
    pauseAtMs: 3_500,
    startAtMs: 1_000,
  },
  pausedFromBlack: {
    id: "paused-from-black",
    purpose: "Verify a paused clock remembers that Black must resume.",
    description: "Black runs for 3000 ms before the clock is paused.",
    expected: "Black resumes later without the paused duration being charged.",
    activeColor: "black",
    pauseAtMs: 5_000,
    startAtMs: 2_000,
  },
  expiredWhite: {
    id: "expired-white-clock",
    purpose: "Verify White expiration at the exact zero boundary.",
    description: "White has 1000 ms and attempts to commit after exactly 1000 ms.",
    expected: "White is expired at zero; no increment or side switch occurs.",
    activeColor: "white",
    expireAtMs: 2_000,
    initialMs: 1_000,
    startAtMs: 1_000,
  },
  expiredBlack: {
    id: "expired-black-clock",
    purpose: "Verify Black expiration after the zero boundary.",
    description: "Black has 1000 ms and is observed after 1500 elapsed milliseconds.",
    expected: "Black is expired and remaining time is clamped to zero.",
    activeColor: "black",
    expireAtMs: 3_500,
    initialMs: 1_000,
    startAtMs: 2_000,
  },
  stopped: {
    id: "stopped-clock",
    purpose: "Verify stopped clock balances remain final.",
    description: "White runs for 4000 ms before the clock is stopped.",
    expected: "Later snapshots preserve both final balances and no clock is active.",
    activeColor: "white",
    startAtMs: 1_000,
    stopAtMs: 5_000,
  },
} as const satisfies Record<string, ClockDomainFixture & Record<string, unknown>>;
