/** A category with its subcategories — mirrors the backend `CategoryResponse`. Two levels only: a subcategory has no children. */
export interface Category {
  readonly id: number;
  /** Id of the parent category; null for a top-level category. */
  readonly parentId: number | null;
  readonly name: string;
  readonly slug: string;
  /** Icon key for the frontend, or null. */
  readonly icon: string | null;
  readonly description: string | null;
  /** Active subcategories in display order. */
  readonly children: readonly Category[];
}

/** A category as named on a listing — mirrors the backend `CategorySummary`. */
export interface CategorySummary {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
}
