import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSession } from '../auth/auth-session';

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
