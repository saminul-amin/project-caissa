import type { GameStartupResult, GameStartupService } from "../bootstrap";
import type { GameRepository, PersistenceError } from "../persistence";

export const DISCARD_ACTIVE_GAME_CONFIRMATION = "discard-active-game" as const;

export interface ConfirmedDiscardActiveGameCommand {
  readonly confirmation: typeof DISCARD_ACTIVE_GAME_CONFIRMATION;
}

export type ActiveGameRecoveryResult =
  | { readonly status: "discarded" }
  | { readonly reason: "confirmation-required"; readonly status: "rejected" }
  | { readonly error: PersistenceError; readonly status: "failed" };

export interface ContinueWithoutRestoringResult {
  readonly storageChanged: false;
  readonly status: "continued";
}

export interface ActiveGameRecoveryService {
  retryRestoration(): Promise<GameStartupResult>;
  discardActiveGame(command: ConfirmedDiscardActiveGameCommand): Promise<ActiveGameRecoveryResult>;
  continueWithoutRestoring(): ContinueWithoutRestoringResult;
}

export interface CreateActiveGameRecoveryServiceOptions {
  readonly gameRepository: GameRepository;
  readonly startupService: GameStartupService;
}

export function createActiveGameRecoveryService(
  options: CreateActiveGameRecoveryServiceOptions,
): ActiveGameRecoveryService {
  return Object.freeze({
    async retryRestoration() {
      return options.startupService.restoreActiveGame();
    },
    async discardActiveGame(
      command: ConfirmedDiscardActiveGameCommand,
    ): Promise<ActiveGameRecoveryResult> {
      if (!isConfirmedDiscard(command)) {
        return Object.freeze({ reason: "confirmation-required", status: "rejected" as const });
      }
      try {
        const result = await options.gameRepository.clearActiveGame();
        return result.status === "cleared"
          ? Object.freeze({ status: "discarded" as const })
          : Object.freeze({ error: freezeError(result.error), status: "failed" as const });
      } catch {
        return Object.freeze({
          error: Object.freeze({
            code: "unknown-storage-error" as const,
            operation: "active-game.discard",
            retryable: true,
          }),
          status: "failed" as const,
        });
      }
    },
    continueWithoutRestoring() {
      return Object.freeze({ status: "continued" as const, storageChanged: false as const });
    },
  });
}

function isConfirmedDiscard(value: unknown): value is ConfirmedDiscardActiveGameCommand {
  return (
    typeof value === "object" &&
    value !== null &&
    "confirmation" in value &&
    value.confirmation === DISCARD_ACTIVE_GAME_CONFIRMATION
  );
}

function freezeError(error: PersistenceError): PersistenceError {
  return Object.freeze({
    code: error.code,
    operation: error.operation,
    retryable: error.retryable,
  });
}
