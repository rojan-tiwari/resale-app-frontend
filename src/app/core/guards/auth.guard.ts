import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSession } from '../auth/auth-session';
import { Toasts } from '../notifications/toasts';

/**
 * Pages that need a signed-in person. Anonymous visitors are sent to the login page, which brings them back afterwards.
 * Guards are a convenience only: the server checks permissions on every request.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return session
    .whenResolved()
    .pipe(
      map(() =>
        session.isAuthenticated()
          ? true
          : router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } }),
      ),
    );
};

/** Pages for visitors who are not signed in (login, registration). Signed-in people are sent home instead. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(AuthSession);
  const router = inject(Router);
  return session
    .whenResolved()
    .pipe(map(() => (session.isAuthenticated() ? router.createUrlTree(['/']) : true)));
};

/**
 * Pages for administrators. Anonymous visitors are sent to the login page (and brought back afterwards); signed-in people
 * who are not administrators are sent home with a message. Like every guard it is a convenience only: the server checks the
 * role on every admin request, so removing this guard would not open anything up.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  const toasts = inject(Toasts);
  return session.whenResolved().pipe(
    map(() => {
      if (!session.isAuthenticated()) {
        return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
      }
      if (session.isAdmin()) {
        return true;
      }
      toasts.error('You do not have access to that page.');
      return router.createUrlTree(['/']);
    }),
  );
};
