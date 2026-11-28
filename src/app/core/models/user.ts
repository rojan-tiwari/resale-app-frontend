/** An account as seen by its owner — mirrors the backend `UserResponse`. It never contains a password or hash. */
export interface User {
  /** UUID. */
  readonly id: string;
  /** Always lower-case. */
  readonly email: string;
  readonly displayName: string;
  /** E.164 Nepali mobile number (`+9779812345678`), or null. */
  readonly phone: string | null;
  /** ISO-8601 instant in UTC. */
  readonly createdAt: string;
  /** Role names such as `ROLE_USER` and `ROLE_ADMIN`, sorted. For showing or hiding UI only: the server enforces permissions. */
  readonly roles: readonly string[];
}
