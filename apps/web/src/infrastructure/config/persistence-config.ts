export const CAISSA_DATABASE_NAME = "caissa" as const;

export interface PersistenceConfiguration {
  readonly databaseName: string;
}

export function createPersistenceConfiguration(
  databaseName: string = CAISSA_DATABASE_NAME,
): PersistenceConfiguration {
  const normalized = databaseName.trim();
  if (normalized.length === 0 || normalized.length > 128) {
    throw new Error("Persistence database name is invalid.");
  }

  return Object.freeze({ databaseName: normalized });
}
