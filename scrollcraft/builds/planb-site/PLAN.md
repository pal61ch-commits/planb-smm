# Plan B full-site QA plan

## 1. Static preflight

1. Verify the route counts and that there are no duplicate entries.
2. Resolve every active route to its source file.
3. Compare every immutable file with the baseline worktree using SHA-256.
4. Preserve title, description, canonical, and JSON-LD values from the baseline for all active routes.
5. Check the exact shared-asset contract:
   - homepage: Scrollcraft plus `home-depth` assets;
   - other marketing routes: Scrollcraft plus `site-depth` assets;
   - current legal routes: `legal-depth.css` only.
6. Resolve all internal links and fragments, including extensionless routes.
7. Verify the sitemap remains the known 41-URL set.

## 2. Local route server

Run `server.mjs`, which mirrors the GitHub Pages resolution used by the live site:

- `/` resolves to `index.html`;
- `/x` resolves to `x.html`;
- `/x/` resolves to `x/index.html`;
- an unknown path returns 404.

This is required because Python's basic HTTP server does not resolve the site's extensionless URLs.

## 3. Full-route render sweep

Render all 43 active routes at:

- 1440 × 900;
- 390 × 844.

Check HTTP and resource status, console exceptions, horizontal overflow, metadata, JSON-LD, broken images, duplicate IDs, labels, control names, blank-target rel attributes, landmarks, asset counts, Scrollcraft instance count, and reveal completion.

## 4. Representative responsive sweep

Render one representative of every page family at:

- 1280 × 720;
- 768 × 1024;
- 360 × 640;
- 320 × 568.

The desktop/mobile representative runs also produce viewport screenshots and execute a keyboard-focus sweep.

## 5. Reduced motion and no-JS

At 390 × 844, representative pages must satisfy:

- reduced-motion media query is active;
- Scrollcraft uses reduced mode;
- no infinite animation remains active;
- smooth scrolling is disabled;
- no reveal content remains hidden;
- with JavaScript disabled, content, navigation, direct contacts, and forms remain visible.

## 6. Consent and form behavior

Test fresh, denied, granted, revoked, expired/tampered analytics choices. No request to Yandex analytics may occur before consent.

For all three lead forms, test validation, focus/error status, exact POST body, attribution fields, success/reset, analytics goal, failure fallback, and button recovery. Both success and failure responses are generated inside Playwright.

## 7. Redirects and evidence

Verify all four legacy redirects preserve query string and fragment. Write a machine-readable report and representative screenshots to `scrollcraft/lab/planb-site/`.

## Run

```bash
cd /Users/konstantin/content-factory/planb-landing-scrollcraft-home/scrollcraft/builds/planb-site
npm install
npm run qa
```

Optional overrides:

```bash
PLANB_SITE_ROOT=/path/to/candidate \
PLANB_BASELINE_ROOT=/path/to/baseline \
SCROLLCRAFT_CHROME=/path/to/chrome \
npm run qa
```
