import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

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
    // Search and filters. The whole search is in the address (?q=...&minPrice=...), so it can be shared.
    path: 'search',
    title: 'Search · ResaleMarket',
    loadComponent: () => import('./features/search/search').then((m) => m.Search),
  },
  {
    path: 'categories',
    pathMatch: 'full',
    title: 'All categories · ResaleMarket',
    loadComponent: () => import('./features/categories/categories').then((m) => m.Categories),
  },
  {
    // A category (and optionally a subcategory) is the search page with that category already chosen.
    path: 'categories/:slug',
    loadComponent: () => import('./features/search/search').then((m) => m.Search),
  },
  {
    path: 'categories/:slug/:sub',
    loadComponent: () => import('./features/search/search').then((m) => m.Search),
  },
  {
    path: 'favorites',
    canActivate: [authGuard],
    title: 'Your favourites · ResaleMarket',
    loadComponent: () => import('./features/favorites/favorites').then((m) => m.Favorites),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    // The signed-in person's own account. The guard is a convenience: the API refuses these calls without a token.
    path: 'profile',
    canActivate: [authGuard],
    loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    // What anyone may see about a member (a seller's profile). Public, like the API endpoint behind it.
    path: 'users/:id',
    title: 'Member profile · ResaleMarket',
    loadComponent: () => import('./features/profile/public-profile').then((m) => m.PublicProfile),
  },
  {
    // Ads: reading one is public; posting, editing and "my ads" need a sign-in (see listings.routes.ts).
    path: 'listings',
    loadChildren: () =>
      import('./features/listings/listings.routes').then((m) => m.LISTINGS_ROUTES),
  },
  {
    path: '**',
    title: 'Page not found · ResaleMarket',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
