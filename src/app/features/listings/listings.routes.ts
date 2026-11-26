import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/**
 * `new` and `mine` come before `:id` so they are never taken for an ad id. Reading an ad is public; posting, editing and "my ads"
 * need a sign-in. The guard is a convenience: the API refuses these calls without a token.
 */
export const LISTINGS_ROUTES: Routes = [
  {
    path: 'new',
    canActivate: [authGuard],
    title: 'Post an ad · ResaleMarket',
    loadComponent: () => import('./listing-form').then((m) => m.ListingForm),
  },
  {
    path: 'mine',
    canActivate: [authGuard],
    title: 'My ads · ResaleMarket',
    loadComponent: () => import('./my-listings').then((m) => m.MyListings),
  },
  {
    path: ':id/edit',
    canActivate: [authGuard],
    title: 'Edit your ad · ResaleMarket',
    loadComponent: () => import('./listing-form').then((m) => m.ListingForm),
  },
  {
    path: ':id',
    // The ad's own title replaces this once it has loaded.
    title: 'Ad · ResaleMarket',
    loadComponent: () => import('./listing-detail').then((m) => m.ListingDetail),
  },
];
