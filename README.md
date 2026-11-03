# Portal

## Keystone

Keystone's staff portal (lending only, one silo). It talks to KS-server; addresses come from src/config/licensee.ts.

## Deploys (KS_SHARED_HOSTING_v1)

`.github/workflows/deploy.yml` runs after CI passes on `main` (or by hand, for one brokerage or all):

- **Development copy** - built and uploaded to its own Azure Static Web App, unchanged.
- **Each brokerage** in `deploy/licensees.json` (enabled, listing `portal`) - built exactly as before, with the
  `VITE_*` variables of its GitHub environment `ks-<code>`, then published by `deploy/publish-site.mjs` to the shared
  web host's storage: blob container `sites`, folder `<code>/portal/`. Every file gets an explicit content type
  (hashed `assets/*` cached for a year, everything else `no-cache`), `index.html` is uploaded last, and files the
  previous build left behind are deleted. The secret is `KS_SITES_STORAGE_CONNECTION_STRING`. Brokerages no longer
  have a Static Web App of their own.

The shared web host (`ks-shared-web`, code in KS-Ops `web-host/`) picks the brokerage by host name, serves the files,
falls back to `index.html` for app routes, and applies the headers in the build's `staticwebapp.config.json` (the CSP
the post-build scripts point at the brokerage's server). It serves files only: there is no `/api` proxy and no
`/.auth`, so the portal always calls KS-server at its absolute address (`src/config/licensee.ts`).

Check a build locally: `npm run build && node deploy/publish-site.mjs portal <code> dist --dry-run`.
Script tests: `node --test deploy/*.test.mjs`.

## Branch protection and merge policy

- Merges to `main` are expected to happen through pull requests.
- Branch protection is configured in GitHub repository settings.
- Direct pushes to `main` should be blocked by GitHub settings.

## CI policy

- CI is strict and blocking for pull requests.
- Installs are strict (`npm ci`) and failures are not ignored.
- Verification runs typecheck, build, tests, and output checks.
- Portal CI includes guard checks for known regressions.

## PWA

The portal is installable on Chrome, Edge, Safari, and iOS using the browser install prompt flow. Service worker update prompts are surfaced via the `bf:sw-update-available` custom event. Push notifications are enabled when `VITE_VAPID_PUBLIC_KEY` is set and BF-Server is configured with the matching VAPID private key plus `/api/push/subscribe` endpoint support (server configuration is out of scope for this repository).1 
