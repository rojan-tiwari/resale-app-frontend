import { ListingStatus } from '../../core/models/listing';
import {
  CONDITION_OPTIONS,
  conditionLabel,
  isEditable,
  isLive,
  placeLabel,
  priceTypeLabel,
  statusBadgeClass,
  statusLabel,
} from './listing-labels';

const ALL: readonly ListingStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'RESERVED',
  'SOLD',
  'REJECTED',
  'ARCHIVED',
];

describe('listing labels', () => {
  it('names every condition for a seller to pick from, best first', () => {
    expect(CONDITION_OPTIONS.map((option) => option.value)).toEqual([
      'NEW',
      'LIKE_NEW',
      'GOOD',
      'FAIR',
      'FOR_PARTS',
    ]);
    expect(conditionLabel('LIKE_NEW')).toBe('Like new');
    expect(conditionLabel('FOR_PARTS')).toBe('For parts or repair');
  });

  it('says what kind of price it is', () => {
    expect(priceTypeLabel('FIXED')).toBe('Fixed price');
    expect(priceTypeLabel('NEGOTIABLE')).toBe('Negotiable');
  });

  it('has words for every status, and always a different badge for the ones that need attention', () => {
    for (const status of ALL) {
      expect(statusLabel(status), status).not.toBe('');
    }
    expect(statusLabel('PENDING_REVIEW')).toBe('Under review');
    expect(statusLabel('ACTIVE')).toBe('Live');
    expect(statusBadgeClass('ACTIVE')).toBe('badge-success');
    expect(statusBadgeClass('REJECTED')).toBe('badge-danger');
    expect(statusBadgeClass('RESERVED')).toBe('badge-brand');
    expect(statusBadgeClass('DRAFT')).toBe('badge-neutral');
  });

  it('knows which statuses are public and which can be edited (as the server does)', () => {
    expect(ALL.filter(isLive)).toEqual(['ACTIVE', 'RESERVED']);
    expect(ALL.filter(isEditable)).toEqual(['DRAFT', 'ACTIVE', 'RESERVED']);
  });

  describe('placeLabel', () => {
    it('lists the area and then the place from the smallest part to the largest', () => {
      expect(
        placeLabel(
          { province: 'Bagmati', district: 'Lalitpur', municipality: 'Godawari' },
          'Taukhel',
        ),
      ).toBe('Taukhel, Godawari, Lalitpur, Bagmati');
    });

    it('does not say a place twice when a municipality is named like its district', () => {
      expect(
        placeLabel({ province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu' }),
      ).toBe('Kathmandu, Bagmati');
    });

    it('skips what is not set', () => {
      expect(placeLabel({ province: 'Bagmati', district: 'Kathmandu', municipality: null })).toBe(
        'Kathmandu, Bagmati',
      );
      expect(placeLabel({ province: null, district: null, municipality: null })).toBe('');
      expect(placeLabel({ province: 'Koshi', district: null, municipality: null }, '   ')).toBe(
        'Koshi',
      );
    });
  });
});
