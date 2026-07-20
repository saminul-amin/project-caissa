import type { StartupRecoveryMetadata } from "../bootstrap";

export type RecoveryActionId = "continue-without-restoring" | "discard-active-game" | "retry";
export type RecoverySeverity = "error" | "warning";

export interface RecoveryReadModel {
  readonly actions: readonly RecoveryActionId[];
  readonly bodyMessageKey: string;
  readonly category: StartupRecoveryMetadata["category"];
  readonly localGameplayCanContinue: true;
  readonly severity: RecoverySeverity;
  readonly storedRecordRemainsUntouched: true;
  readonly titleMessageKey: string;
}

export function createRecoveryReadModel(recovery: StartupRecoveryMetadata): RecoveryReadModel {
  const actions: RecoveryActionId[] = [];
  if (recovery.retryMeaningful) actions.push("retry");
  actions.push("discard-active-game");
  actions.push("continue-without-restoring");

  return Object.freeze({
    actions: Object.freeze(actions),
    bodyMessageKey: `recovery.active-game.${recovery.category}.body`,
    category: recovery.category,
    localGameplayCanContinue: true,
    severity: recovery.category === "terminal-session-in-active-slot" ? "warning" : "error",
    storedRecordRemainsUntouched: true,
    titleMessageKey: `recovery.active-game.${recovery.category}.title`,
  });
}
