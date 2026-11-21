import { Routes } from '@angular/router';

/** The signed-in person's account pages, lazy-loaded under `/profile`. The parent route in `app.routes.ts` applies `authGuard`. */
export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Your profile · ResaleMarket',
    loadComponent: () => import('./profile').then((m) => m.Profile),
  },
  {
    path: 'password',
    title: 'Change your password · ResaleMarket',
    loadComponent: () => import('./change-password').then((m) => m.ChangePassword),
  },
];
