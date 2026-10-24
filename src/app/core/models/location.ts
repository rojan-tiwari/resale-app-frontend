/** Nepal's location hierarchy: province -> district -> municipality. Mirrors the backend `location` module DTOs. */
export interface Province {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  /** Nepali name, for the future localisation. */
  readonly nameNe: string | null;
}

export interface District {
  readonly id: number;
  readonly provinceId: number;
  readonly name: string;
  readonly slug: string;
}

export type MunicipalityType = 'METROPOLITAN' | 'SUB_METROPOLITAN' | 'MUNICIPALITY' | 'RURAL_MUNICIPALITY';

export interface Municipality {
  readonly id: number;
  readonly districtId: number;
  readonly name: string;
  readonly slug: string;
  readonly type: MunicipalityType;
  /** Major cities are listed first in location pickers. */
  readonly major: boolean;
}
