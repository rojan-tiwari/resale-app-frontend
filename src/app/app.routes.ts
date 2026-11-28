import { Routes } from '@angular/router';

/**
 * Every feature is lazy-loaded so the initial bundle stays small. Later phases add routes in the same style and
 * protect them with functional guards from core/guards.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'ResaleMarket · Buy and sell second-hand in Nepal',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '**',
    title: 'Page not found · ResaleMarket',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
