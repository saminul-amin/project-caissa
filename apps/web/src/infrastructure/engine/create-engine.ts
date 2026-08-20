import { detectEngineCapabilities, type EngineCapabilityReport } from "./engine-capabilities";
import { createWorkerEngineTransport } from "./engine-transport";
import { createStockfishEngineClient } from "./stockfish-engine-client";
import type { ChessEnginePort } from "./engine-port";

/**
 * The vendored engine build. Every field is release-relevant: the identifier and version
 * are recorded with analysis cache entries and reviews so stored results can never be
 * attributed to the wrong engine.
 */
export const BUNDLED_ENGINE = Object.freeze({
  assetPath: "engine/stockfish-18-lite-single.js",
  engineId: "stockfish-18-lite-single",
  engineVersion: "18.0.8-lite-single",
  license: "GPL-3.0-or-later",
  upstream: "https://github.com/nmrugg/stockfish.js",
});

export interface CreateBundledEngineOptions {
  readonly baseUrl?: string;
  readonly capabilities?: EngineCapabilityReport;
  readonly documentUrl?: string;
  readonly hashMegabytes?: number;
}

export type CreateBundledEngineResult =
  | { readonly engine: ChessEnginePort; readonly status: "created" }
  | { readonly capabilities: EngineCapabilityReport; readonly status: "unsupported" };

/** Resolves the engine asset relative to the deployed document so subpath and itch.io hosting both work. */
export function resolveEngineScriptUrl(baseUrl: string, documentUrl: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(`${normalizedBase}${BUNDLED_ENGINE.assetPath}`, documentUrl).href;
}

export function createBundledEngine(
  options: CreateBundledEngineOptions = {},
): CreateBundledEngineResult {
  const capabilities = options.capabilities ?? detectEngineCapabilities();
  if (!capabilities.supported) {
    return Object.freeze({ capabilities, status: "unsupported" as const });
  }

  const baseUrl = options.baseUrl ?? "./";
  const documentUrl = options.documentUrl ?? currentDocumentUrl();

  const engine = createStockfishEngineClient({
    createTransport: createWorkerEngineTransport({
      scriptUrl: resolveEngineScriptUrl(baseUrl, documentUrl),
    }),
    engineId: BUNDLED_ENGINE.engineId,
    engineVersion: BUNDLED_ENGINE.engineVersion,
    ...(options.hashMegabytes === undefined ? {} : { hashMegabytes: options.hashMegabytes }),
  });

  return Object.freeze({ engine, status: "created" as const });
}

function currentDocumentUrl(): string {
  return typeof location === "undefined" ? "http://localhost/" : location.href;
}
