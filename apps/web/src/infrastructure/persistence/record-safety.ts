import type {
  CorruptedRecordMetadata,
  CorruptionCategory,
  DurableRecordType,
} from "../../application/persistence";

const safeKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:+-]*$/u;

export function corruptedRecord(
  recordType: DurableRecordType,
  recordKey: unknown,
  category: CorruptionCategory,
  rawRecoveryMayBePossible: boolean,
): CorruptedRecordMetadata {
  return Object.freeze({
    category,
    rawRecoveryMayBePossible,
    recordKey: safeRecordKey(recordKey),
    recordType,
  });
}

function safeRecordKey(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 128 ||
    !safeKeyPattern.test(value)
  ) {
    return "unavailable";
  }

  return value;
}
