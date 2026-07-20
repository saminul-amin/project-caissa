/**
 * Version 1 has no predecessor data to transform. Keeping the named upgrade seam beside the
 * explicit schema makes future forward-only migrations additive and independently testable.
 */
export function migrateToVersionOne(transaction: unknown): void {
  void transaction;
}
