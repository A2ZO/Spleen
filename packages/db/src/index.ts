export {
  createDb,
  defaultPgliteDir,
  isPostgresUrl,
  migrationDatabaseUrl,
  type Db,
  type DbHandle,
  type Schema,
} from "./client";
export {
  deleteE2eAccounts,
  freesUsernamesAtOnce,
  isE2eEmail,
  neonEndpointId,
  unsafeE2eDatabase,
} from "./e2e";
export { setAdminRole, type AdminRoleResult } from "./admin";
export { loadRootEnv, rootEnvFile } from "./env";
export { rowsOf } from "./rows";
export { queryTraceEnabled, takeQueryTrace, type TracedQuery } from "./trace";
export {
  bumpStatsVersion,
  listenedTargets,
  ratedTrackIds,
  recomputeItemState,
  setWantToListen,
  type DbOrTx,
  type ListenTarget,
} from "./listening-state";
export * as schema from "./schema";
export { seed } from "./seed/seed";
export { slugify } from "./seed/slugify";
// Query helpers re-exported so every package uses this package's drizzle-orm instance.
export {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
