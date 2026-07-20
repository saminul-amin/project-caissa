import type Dexie from "dexie";

import { migrateToVersionOne } from "./migrations";

export const CAISSA_DATABASE_VERSION = 1 as const;

export const VERSION_ONE_STORES = Object.freeze({
  activeGames: "&key,gameId,updatedAt",
  analysisCache:
    "&key,expiresAt,createdAt,engineId,engineVersion,analysisProfile,[engineId+engineVersion]",
  completedGames:
    "&gameId,completedAt,resultType,whiteParticipantKind,blackParticipantKind,[completedAt+gameId]",
  preferences: "&key,updatedAt",
  reviews: "&gameId,status,updatedAt",
});

/** Explicit named Version 1 definition; future versions add separate named upgrade functions. */
export function defineVersionOneSchema(database: Dexie): void {
  database.version(CAISSA_DATABASE_VERSION).stores(VERSION_ONE_STORES).upgrade(migrateToVersionOne);
}
