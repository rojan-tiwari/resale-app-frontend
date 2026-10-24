/** Response of `GET /api/v1/system/ping` — see backend `SystemInfoResponse`. */
export interface SystemInfo {
  readonly application: string;
  readonly version: string;
  /** Active Spring profile(s), e.g. `dev`. */
  readonly environment: string;
  /** ISO-8601 instant in UTC. */
  readonly serverTime: string;
  readonly database: DatabaseInfo;
}

export interface DatabaseInfo {
  readonly status: 'UP' | 'DOWN';
  /** PostgreSQL server version, e.g. `16.4`. Null when the database is down. */
  readonly version: string | null;
  readonly migrationsApplied: number;
  /** Latest successfully applied Flyway version, e.g. `10`. */
  readonly latestMigration: string | null;
}
