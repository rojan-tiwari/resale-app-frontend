import type { Environment } from './environment.model';

/** Production defaults (replaced by environment.development.ts during `ng serve` / development builds). */
export const environment: Environment = {
  production: true,
  appName: 'ResaleMarket',
  apiBaseUrl: '/api/v1',
  apiDocsUrl: null,
};
