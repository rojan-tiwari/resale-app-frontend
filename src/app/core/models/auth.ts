import { User } from './user';

/** Body of `POST /api/v1/auth/register` — mirrors the backend `RegisterRequest`. */
export interface RegisterRequest {
  readonly email: string;
  /** Sent as typed (never trimmed); the backend hashes it with BCrypt and returns no trace of it. */
  readonly password: string;
  readonly displayName: string;
  /** A Nepali mobile number such as `9812345678` (with or without `+977`), or null to omit it. */
  readonly phone: string | null;
}

/** Body of `POST /api/v1/auth/login` — mirrors the backend `LoginRequest`. */
export interface LoginRequest {
  readonly email: string;
  /** Sent as typed (never trimmed). */
  readonly password: string;
}

/**
 * Answer of login and refresh — mirrors the backend `AuthResponse`.
 * The long-lived refresh token is not in here: it is an HttpOnly cookie that scripts cannot read.
 */
export interface AuthResponse {
  /** JWT for `Authorization: Bearer`. Keep it in memory only, never in web storage. */
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  /** Seconds until the access token expires. */
  readonly expiresIn: number;
  readonly user: User;
}

/** Body of `POST /api/v1/auth/forgot-password`. */
export interface ForgotPasswordRequest {
  readonly email: string;
}

/** Body of `POST /api/v1/auth/reset-password`: the `token` of the link in the e-mail and the new password. */
export interface ResetPasswordRequest {
  readonly token: string;
  /** Sent as typed (never trimmed). */
  readonly newPassword: string;
}

/** Body of `PUT /api/v1/users/me/password`. */
export interface ChangePasswordRequest {
  /** Sent as typed (never trimmed). */
  readonly currentPassword: string;
  readonly newPassword: string;
}
