import type { EngineLoadProgress } from "./engine-port";

export interface EngineTransportHandlers {
  onError(detail: unknown): void;
  onLine(line: string): void;
  onProgress(progress: EngineLoadProgress): void;
}

export interface EngineTransport {
  post(command: string): void;
  terminate(): void;
}

export type CreateEngineTransport = (handlers: EngineTransportHandlers) => EngineTransport;

export interface WorkerEngineTransportOptions {
  readonly scriptUrl: string;
  readonly workerFactory?: (url: string) => Worker;
}

const maximumProgressBytes = 512 * 1024 * 1024;

/**
 * Classic Web Worker transport for the vendored Stockfish build.
 *
 * The build resolves its own WebAssembly payload from the script URL, and reports
 * download progress over a dedicated MessagePort so the interface can show a
 * determinate loading state for the multi-megabyte engine asset.
 */
export function createWorkerEngineTransport(
  options: WorkerEngineTransportOptions,
): CreateEngineTransport {
  return (handlers) => {
    const factory = options.workerFactory ?? ((url: string) => new Worker(url));
    let worker: Worker | undefined;
    let terminated = false;

    try {
      worker = factory(options.scriptUrl);
    } catch (error: unknown) {
      queueMicrotask(() => {
        handlers.onError(error);
      });
      return Object.freeze({
        post() {
          /* The transport never started; commands are intentionally dropped. */
        },
        terminate() {
          terminated = true;
        },
      });
    }

    const activeWorker = worker;
    activeWorker.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (typeof event.data === "string") handlers.onLine(event.data);
    });
    activeWorker.addEventListener("error", (event: Event) => {
      handlers.onError(event);
    });
    activeWorker.addEventListener("messageerror", () => {
      handlers.onError(new Error("Engine transport received an undeserializable message."));
    });

    attachProgressPort(activeWorker, handlers);

    return Object.freeze({
      post(command: string) {
        if (terminated) return;
        activeWorker.postMessage(command);
      },
      terminate() {
        if (terminated) return;
        terminated = true;
        try {
          activeWorker.postMessage("quit");
        } catch {
          /* The worker may already be gone; termination continues regardless. */
        }
        activeWorker.terminate();
      },
    });
  };
}

function attachProgressPort(worker: Worker, handlers: EngineTransportHandlers): void {
  if (typeof MessageChannel !== "function") return;

  let channel: MessageChannel;
  try {
    channel = new MessageChannel();
  } catch {
    return;
  }

  channel.port1.addEventListener("message", (event: MessageEvent<unknown>) => {
    const progress = readProgress(event.data);
    if (progress) handlers.onProgress(progress);
  });
  channel.port1.start();

  try {
    worker.postMessage({ progressPort: channel.port2 }, [channel.port2]);
  } catch {
    /* Progress reporting is optional; the engine still loads without it. */
  }
}

function readProgress(value: unknown): EngineLoadProgress | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as { loaded?: unknown; percent?: unknown; total?: unknown };
  if (
    typeof candidate.loaded !== "number" ||
    typeof candidate.total !== "number" ||
    !Number.isFinite(candidate.loaded) ||
    !Number.isFinite(candidate.total) ||
    candidate.total <= 0 ||
    candidate.total > maximumProgressBytes ||
    candidate.loaded < 0
  ) {
    return undefined;
  }

  const loadedBytes = Math.min(candidate.loaded, candidate.total);
  return Object.freeze({
    loadedBytes,
    ratio: loadedBytes / candidate.total,
    totalBytes: candidate.total,
  });
}
