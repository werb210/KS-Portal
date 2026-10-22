# Portal

## Keystone

Keystone's staff portal (lending only, one silo). It talks to KS-server; addresses come from src/config/licensee.ts.

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
