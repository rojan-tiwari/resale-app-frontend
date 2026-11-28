import { Service, computed, inject, signal } from '@angular/core';
import {
  Observable,
  ReplaySubject,
  catchError,
  defer,
  finalize,
  map,
  of,
  shareReplay,
  take,
  tap,
} from 'rxjs';
import { toApiError } from '../models/api-error';
import { AuthResponse, LoginRequest } from '../models/auth';
import { User } from '../models/user';
import { AuthApi } from '../services/auth-api';

/**
 * `unknown` until the server has said whether the refresh cookie still holds a session (a few milliseconds after
 * start-up), then `authenticated` or `anonymous`.
 */
export type SessionStatus = 'unknown' | 'anonymous' | 'authenticated';

/**
 * Who is signed in. This is the single place that knows the access token.
 *
 * The access token is kept in memory only: not in `localStorage`, `sessionStorage` or a readable cookie, because
 * anything a script can read, an injected script can steal. A reload therefore loses it, and the session is restored
 * by one silent call to `/auth/refresh`, which the HttpOnly refresh cookie authenticates.
 *
 * Components read `user` / `status`; they never see a token. The interceptor reads it through `accessToken()`.
 */
@Service()
export class AuthSession {
  private readonly api = inject(AuthApi);

  private readonly userState = signal<User | null>(null);
  private readonly statusState = signal<SessionStatus>('unknown');
  private token: string | null = null;
  private restoreStarted = false;
  private refreshing: Observable<string> | null = null;
  private readonly resolved = new ReplaySubject<void>(1);

  /** The signed-in account, or null. */
  readonly user = this.userState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly isAuthenticated = computed(() => this.statusState() === 'authenticated');

  /** The current access token, for the interceptor. Not reactive on purpose: nothing should render it. */
  accessToken(): string | null {
    return this.token;
  }

  /**
   * Signs in. Fails with an `ApiError`: 401 for a wrong email or password, 403 for a suspended account,
   * 400 (with `fieldErrors`) for missing fields.
   */
  login(request: LoginRequest): Observable<User> {
    return this.api.login(request).pipe(
      tap((response) => this.adopt(response)),
      map((response) => response.user),
    );
  }

  /** Signs out. The screen changes at once; a failed server call is ignored because there is nothing a person could do about it. */
  logout(): Observable<void> {
    return defer(() => {
      this.clear();
      return this.api.logout();
    }).pipe(catchError(() => of(undefined)));
  }

  /**
   * Finds out whether the browser still has a session (the refresh cookie) and starts it. Runs once at start-up;
   * calling it again does nothing. It never fails: the answer is `status`.
   */
  restore(): void {
    if (this.restoreStarted) {
      return;
    }
    this.restoreStarted = true;
    this.refresh().subscribe({ error: () => undefined });
  }

  /**
   * Exchanges the refresh cookie for a new access token and returns it. Calls that overlap share one request: the server
   * rotates the refresh token on every use, so two simultaneous refreshes from this tab would look like token theft.
   *
   * A 401 means the session is over and signs the person out here; other failures (such as a lost connection) keep
   * the session, because the cookie may still be good.
   */
  refresh(): Observable<string> {
    this.refreshing ??= this.api.refresh().pipe(
      tap({
        next: (response) => this.adopt(response),
        error: (error: unknown) => {
          if (toApiError(error).isUnauthorized || this.statusState() === 'unknown') {
            this.clear();
          }
        },
      }),
      map((response) => response.accessToken),
      finalize(() => (this.refreshing = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshing;
  }

  /**
   * Emits once the first answer about the session is known. Route guards wait for it, so reloading a page that needs
   * a sign-in does not bounce a signed-in person to the login page while the session is still being restored.
   */
  whenResolved(): Observable<void> {
    this.restore();
    return this.resolved.pipe(take(1));
  }

  private adopt(response: AuthResponse): void {
    this.token = response.accessToken;
    this.userState.set(response.user);
    this.statusState.set('authenticated');
    this.resolved.next();
  }

  private clear(): void {
    this.token = null;
    this.userState.set(null);
    this.statusState.set('anonymous');
    this.resolved.next();
  }
}
