# ResaleMarket — Angular frontend

Angular 22 (standalone components, signals, lazy routes, zoneless) with Tailwind CSS 4 and Vitest. Part of the monorepo described in the [root README](../README.md);
architecture notes are in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) and the coding rules in [CLAUDE.md](CLAUDE.md).

Requires Node.js 24.15+ (or 22.22.3+). From this folder:

```bash
npm ci                    # install exact dependency versions
npm start                 # dev server on http://localhost:4200 (proxies /api to http://localhost:8080)
npm test -- --no-watch    # unit tests (Vitest + jsdom)
npm run build             # production build into dist/
```

- `proxy.conf.json` forwards `/api`, `/swagger-ui` and `/v3/api-docs` to the backend, so the browser talks to a single origin.
- `src/environments/` holds the environment files; the API base URL is the relative `/api/v1` in every environment (a reverse proxy serves SPA and API from one origin in production).
- `src/styles.css` contains the Tailwind theme (brand colours, radii, shadows) and the reusable component classes.
