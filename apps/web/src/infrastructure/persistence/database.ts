import Dexie, { type Table } from "dexie";

import type { PersistenceError } from "../../application/persistence";
import { CAISSA_DATABASE_NAME } from "../config/persistence-config";
import { mapPersistenceError } from "./error-mapper";
import { defineVersionOneSchema } from "./schema";
import type {
  ActiveGameStorageRecord,
  AnalysisCacheStorageRecord,
  CompletedGameStorageRecord,
  PreferencesStorageRecord,
  ReviewStorageRecord,
} from "./storage-records";

export interface CreateCaissaDatabaseOptions {
  readonly IDBKeyRange?: typeof IDBKeyRange;
  readonly indexedDB?: IDBFactory;
  readonly name?: string;
}

export type DatabaseOpenResult =
  | { readonly database: CaissaDatabase; readonly status: "opened" }
  | { readonly error: PersistenceError; readonly status: "failed" };

export type DatabaseDeleteResult =
  { readonly status: "deleted" } | { readonly error: PersistenceError; readonly status: "failed" };

export class CaissaDatabase extends Dexie {
  readonly activeGames!: Table<ActiveGameStorageRecord, string>;
  readonly analysisCache!: Table<AnalysisCacheStorageRecord, string>;
  readonly completedGames!: Table<CompletedGameStorageRecord, string>;
  readonly preferences!: Table<PreferencesStorageRecord, string>;
  readonly reviews!: Table<ReviewStorageRecord, string>;

  constructor(options: CreateCaissaDatabaseOptions = {}) {
    const dexieOptions = createDexieOptions(options);
    super(options.name ?? CAISSA_DATABASE_NAME, dexieOptions);
    defineVersionOneSchema(this);

    this.activeGames = this.table("activeGames");
    this.analysisCache = this.table("analysisCache");
    this.completedGames = this.table("completedGames");
    this.preferences = this.table("preferences");
    this.reviews = this.table("reviews");
  }
}

export function createCaissaDatabase(options: CreateCaissaDatabaseOptions = {}): CaissaDatabase {
  return new CaissaDatabase(options);
}

export async function openCaissaDatabase(database: CaissaDatabase): Promise<DatabaseOpenResult> {
  try {
    await database.open();
    return { database, status: "opened" };
  } catch (error: unknown) {
    return { error: mapPersistenceError(error, "database.open"), status: "failed" };
  }
}

export function closeCaissaDatabase(database: CaissaDatabase): void {
  database.close({ disableAutoOpen: true });
}

/** Restricted lifecycle operation for isolated tests and deliberate development resets only. */
export async function deleteCaissaDatabase(
  database: CaissaDatabase,
  purpose: "development" | "test",
): Promise<DatabaseDeleteResult> {
  try {
    void purpose;
    await database.delete();
    return { status: "deleted" };
  } catch (error: unknown) {
    return { error: mapPersistenceError(error, "database.delete"), status: "failed" };
  }
}

function createDexieOptions(options: CreateCaissaDatabaseOptions): {
  IDBKeyRange?: typeof IDBKeyRange;
  indexedDB?: IDBFactory;
} {
  return {
    ...(options.IDBKeyRange ? { IDBKeyRange: options.IDBKeyRange } : {}),
    ...(options.indexedDB ? { indexedDB: options.indexedDB } : {}),
  };
}
