import { BUNDLED_ENGINE } from "../../infrastructure/engine";

/** Injected at build time so a published build can always be identified. */
export const CAISSA_VERSION: string =
  (import.meta.env.VITE_CAISSA_VERSION as string | undefined) ?? "0.1.0-dev";

export const BUNDLED_ENGINE_SUMMARY = Object.freeze({
  license: BUNDLED_ENGINE.license,
  name: `Stockfish ${BUNDLED_ENGINE.engineVersion}`,
  upstream: BUNDLED_ENGINE.upstream,
});
