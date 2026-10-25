import { Routes } from '@angular/router';

/** Authentication pages, lazy-loaded under `/auth`. Login, forgot and reset password join as Phase 2 grows. */
export const AUTH_ROUTES: Routes = [
  {
    path: 'register',
    title: 'Create an account · ResaleMarket',
    loadComponent: () => import('./register').then((m) => m.Register),
  },
];
