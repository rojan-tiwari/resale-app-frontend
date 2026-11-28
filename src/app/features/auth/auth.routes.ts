import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/auth.guard';

/**
 * Authentication pages, lazy-loaded under `/auth`. Forgot and reset password join as Phase 2 grows.
 * People who are already signed in have no business here, so `guestGuard` sends them home.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    title: 'Sign in · ResaleMarket',
    canActivate: [guestGuard],
    loadComponent: () => import('./login').then((m) => m.Login),
  },
  {
    path: 'register',
    title: 'Create an account · ResaleMarket',
    canActivate: [guestGuard],
    loadComponent: () => import('./register').then((m) => m.Register),
  },
];
