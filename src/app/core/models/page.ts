/** Standard paginated response used by every list endpoint — mirrors backend `PageResponse<T>`. */
export interface Page<T> {
  readonly content: readonly T[];
  /** Zero-based page index. */
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
  readonly first: boolean;
  readonly last: boolean;
}
