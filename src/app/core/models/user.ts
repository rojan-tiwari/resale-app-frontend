/** An account as seen by its owner — mirrors the backend `UserResponse`. It never contains a password or hash. */
export interface User {
  /** UUID. */
  readonly id: string;
  /** Always lower-case. */
  readonly email: string;
  readonly displayName: string;
  /** E.164 Nepali mobile number (`+9779812345678`), or null. */
  readonly phone: string | null;
  /** Whether the phone number is shown on the public profile. Only ever true together with a phone number. */
  readonly showPhone: boolean;
  /** A few words about the person (at most 500 characters), or null. */
  readonly bio: string | null;
  /** Ids from the location API; the district needs the province, the municipality needs the district. */
  readonly provinceId: number | null;
  readonly districtId: number | null;
  readonly municipalityId: number | null;
  /** ISO-8601 instant in UTC. */
  readonly createdAt: string;
  /** Role names such as `ROLE_USER` and `ROLE_ADMIN`, sorted. For showing or hiding UI only: the server enforces permissions. */
  readonly roles: readonly string[];
}

/**
 * Body of `PUT /api/v1/users/me` — mirrors the backend `UpdateProfileRequest`. The whole profile is replaced: an optional
 * field that is null is cleared on the server.
 */
export interface UpdateProfileRequest {
  readonly displayName: string;
  /** A Nepali mobile number such as `9812345678` (with or without `+977`), or null. */
  readonly phone: string | null;
  /** Show the phone number on the public profile. The server refuses it without a phone number. */
  readonly showPhone: boolean;
  readonly bio: string | null;
  readonly provinceId: number | null;
  readonly districtId: number | null;
  readonly municipalityId: number | null;
}

/** The names behind a place, each null when it was not chosen — mirrors the backend `LocationNames`. */
export interface LocationNames {
  readonly province: string | null;
  readonly district: string | null;
  readonly municipality: string | null;
}

/** What anyone may see about a member — mirrors the backend `PublicUserResponse`. No email address, ever. */
export interface PublicUser {
  readonly id: string;
  readonly displayName: string;
  readonly bio: string | null;
  /** ISO-8601 instant in UTC. */
  readonly memberSince: string;
  readonly location: LocationNames;
  /** E.164 number, or null unless its owner agreed to show it. */
  readonly phone: string | null;
}
