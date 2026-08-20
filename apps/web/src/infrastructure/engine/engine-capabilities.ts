/**
 * Runtime capability detection for the bundled engine.
 *
 * Caissa ships a single-threaded WebAssembly SIMD build so that itch.io embedding never
 * depends on cross-origin isolation. Detection stays honest: when a capability is
 * missing the product disables the engine instead of degrading silently.
 */

export type EngineCapabilityGap = "no-wasm" | "no-wasm-simd" | "no-worker";

export interface EngineCapabilityReport {
  readonly gaps: readonly EngineCapabilityGap[];
  readonly supported: boolean;
  /** Present when the runtime is cross-origin isolated; recorded for diagnostics only. */
  readonly crossOriginIsolated: boolean;
}

/** Minimal module using `i32x4.splat` and `v128.any_true`; valid only with SIMD support. */
const simdProbe = Uint8Array.from([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15,
  253, 98, 11,
]);

export interface EngineCapabilityScope {
  readonly WebAssembly?: typeof WebAssembly;
  readonly Worker?: unknown;
  readonly crossOriginIsolated?: boolean;
}

export function detectEngineCapabilities(
  scope: EngineCapabilityScope = globalThis,
): EngineCapabilityReport {
  const gaps: EngineCapabilityGap[] = [];

  if (typeof scope.Worker !== "function") gaps.push("no-worker");

  const wasm = scope.WebAssembly;
  if (typeof wasm !== "object" || typeof wasm.validate !== "function") {
    gaps.push("no-wasm");
  } else if (!validateQuietly(wasm, simdProbe)) {
    gaps.push("no-wasm-simd");
  }

  return Object.freeze({
    crossOriginIsolated: scope.crossOriginIsolated === true,
    gaps: Object.freeze(gaps),
    supported: gaps.length === 0,
  });
}

export function describeEngineCapabilityGap(gap: EngineCapabilityGap): string {
  switch (gap) {
    case "no-worker":
      return "This browser does not support the background workers Caissa needs to run the engine.";
    case "no-wasm":
      return "This browser does not support WebAssembly, which the engine requires.";
    case "no-wasm-simd":
      return "This browser does not support WebAssembly SIMD, which the bundled engine build requires.";
  }
}

function validateQuietly(wasm: typeof WebAssembly, bytes: Uint8Array): boolean {
  try {
    return wasm.validate(bytes as unknown as BufferSource);
  } catch {
    return false;
  }
}
