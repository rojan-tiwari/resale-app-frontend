import { ListingCondition, ListingStatus, PriceType } from '../../core/models/listing';
import { LocationNames } from '../../core/models/user';

/** The words people see for each condition, in the order a seller picks from. */
export const CONDITION_OPTIONS: readonly {
  readonly value: ListingCondition;
  readonly label: string;
}[] = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like new' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'FOR_PARTS', label: 'For parts or repair' },
];

const CONDITION_LABELS: Readonly<Record<ListingCondition, string>> = Object.fromEntries(
  CONDITION_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ListingCondition, string>;

export function conditionLabel(condition: ListingCondition): string {
  return CONDITION_LABELS[condition];
}

export function priceTypeLabel(type: PriceType): string {
  return type === 'NEGOTIABLE' ? 'Negotiable' : 'Fixed price';
}

const STATUS_LABELS: Readonly<Record<ListingStatus, string>> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Under review',
  ACTIVE: 'Live',
  RESERVED: 'Reserved',
  SOLD: 'Sold',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
};

export function statusLabel(status: ListingStatus): string {
  return STATUS_LABELS[status];
}

/** The badge class of a status (see `styles.css`). The words always say the status too: colour is never the only signal. */
export function statusBadgeClass(status: ListingStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'badge-success';
    case 'RESERVED':
      return 'badge-brand';
    case 'REJECTED':
      return 'badge-danger';
    default:
      return 'badge-neutral';
  }
}

/** A listing that a visitor can see and contact the seller about. */
export function isLive(status: ListingStatus): boolean {
  return status === 'ACTIVE' || status === 'RESERVED';
}

/** The seller may change the content of a listing in these statuses; the others are frozen until it is moved back to a draft. */
export function isEditable(status: ListingStatus): boolean {
  return status === 'DRAFT' || status === 'ACTIVE' || status === 'RESERVED';
}

/**
 * "Baneshwor, Kathmandu, Bagmati": the area, then the parts of the place that are set, smallest first. A municipality is often
 * named like its district ("Kathmandu"), and saying it twice reads badly, so repeats are dropped.
 */
export function placeLabel(location: LocationNames, locality: string | null = null): string {
  const parts = [locality, location.municipality, location.district, location.province].filter(
    (part): part is string => part !== null && part.trim() !== '',
  );
  return parts.filter((part, index) => parts.indexOf(part) === index).join(', ');
}
