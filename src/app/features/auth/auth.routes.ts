import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/auth.guard';

/**
 * Authentication pages, lazy-loaded under `/auth`. People who are already signed in have no business at login,
 * registration or "forgot password", so `guestGuard` sends them home. The reset page has no guard: a reset link must work
 * for whoever opens it, signed in or not.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    title: 'Sign in · ResaleMarket',
    canActivate: [guestGuard],
    loadComponent: () => import('./login').then((m) => m.Login),
  },
  {
    path: 'forgot-password',
    title: 'Forgot your password? · ResaleMarket',
    canActivate: [guestGuard],
    loadComponent: () => import('./forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    title: 'Choose a new password · ResaleMarket',
    loadComponent: () => import('./reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'register',
    title: 'Create an account · ResaleMarket',
    canActivate: [guestGuard],
    loadComponent: () => import('./register').then((m) => m.Register),
  },
];
