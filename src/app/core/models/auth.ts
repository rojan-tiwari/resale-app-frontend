/** Body of `POST /api/v1/auth/register` — mirrors the backend `RegisterRequest`. */
export interface RegisterRequest {
  readonly email: string;
  /** Sent as typed (never trimmed); the backend hashes it with BCrypt and returns no trace of it. */
  readonly password: string;
  readonly displayName: string;
  /** A Nepali mobile number such as `9812345678` (with or without `+977`), or null to omit it. */
  readonly phone: string | null;
}
