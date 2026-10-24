/** Shape shared by every environment file. Add new settings here first so all files stay in sync. */
export interface Environment {
  /** True for production builds. */
  readonly production: boolean;
  /** Product name shown in the UI. */
  readonly appName: string;
  /**
   * Base URL of the REST API. Relative on purpose: in development the Angular dev server proxies
   * `/api` to the backend (proxy.conf.json) and in production a reverse proxy serves both from
   * one origin. Same-origin keeps the HttpOnly refresh-token cookie simple and avoids CORS preflights.
   */
  readonly apiBaseUrl: string;
  /** Swagger UI location, shown as a developer link; null hides it. */
  readonly apiDocsUrl: string | null;
}
