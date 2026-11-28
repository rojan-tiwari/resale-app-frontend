import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { AuthSession } from './core/auth/auth-session';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { problemDetailInterceptor } from './core/interceptors/problem-detail.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    // Interceptor order matters: authInterceptor is outermost, so it sees failures already converted to ApiError.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, problemDetailInterceptor])),
    // Starts the silent session restore right away, without delaying the first render: the header shows a placeholder
    // until the answer arrives, and route guards wait for it.
    provideAppInitializer(() => inject(AuthSession).restore()),
  ],
};
