# Verification record

## Harness implementation

- Status: implemented locally; not a production check.
- Candidate root: isolated release worktree supplied through `PLANB_SITE_ROOT`; the machine-readable report records the resolved path.
- Baseline root: `/Users/konstantin/content-factory/planb-landing`
- Browser: local Google Chrome through `playwright-core` 1.58.2.
- Evidence directory: `scrollcraft/lab/planb-site/`.

## Implemented gates

- Exact route and immutable-file counts.
- SHA-256 comparison with the baseline worktree.
- GitHub Pages-like extensionless route server.
- Static SEO, JSON-LD, assets, sitemap, internal links, and fragment contracts.
- BlogPosting, FAQPage, BreadcrumbList, CollectionPage, ItemList, and VideoObject contracts for the new content routes.
- Homepage social-presence block with exact Instagram, Telegram, and VK destinations.
- Two self-hosted MP4 files, posters and WebVTT captions; local server MIME and byte-range delivery checked separately.
- All-route desktop/mobile rendering.
- Representative laptop/tablet/compact/minimum rendering.
- Representative reduced-motion and no-JS rendering.
- Resource, console, overflow, image, ID, landmark, form-label, accessible-name, and keyboard-focus checks.
- Consent lifecycle without live analytics execution.
- Three lead-form success/failure paths with the external endpoint intercepted.
- Redirect target/query/fragment verification.

## Required manual gates

- Visual inspection of every page family by the owner.
- Real desktop browser and real phone testing.
- Real iPhone Safari safe-area, font rendering, and touch behavior.
- Screen-reader and contrast review where automation cannot establish the effective composited color.
- Live production readback only after a separately approved deployment.
- One explicitly authorized live lead canary only if delivery verification is requested.

## Latest completed run

- Completed: 2026-09-28 07:33:44 UTC.
- Verdict: **PASS**.
- Marketing routes: 46.
- Active routes: 51 of 51.
- Sitemap URLs: 49.
- Blog routes: 26, including the index and 25 article pages.
- Browser runs: 162, including every active route on desktop and mobile.
- Form runs: 6, covering local success and failure responses for all three forms.
- Redirect runs: 4 of 4.
- Immutable baseline comparisons: 19 of 19 unchanged.
- Failures: 0.
- Warnings: 0.
- Content OS: 25 of 25 unit tests passed.
- Article gate: all 4 release slugs passed with the live Content OS evidence database.
- `npm audit`: 0 vulnerabilities.

## Previous completed run (historical)

- Completed: 2026-09-25 11:18:39 UTC.
- Verdict: **PASS**.
- Active routes: 47 of 47.
- Browser runs: 154.
- Form runs: 6, covering local success and failure responses for all three forms.
- Redirect runs: 4 of 4.
- Immutable baseline comparisons: 19 of 19 unchanged.
- Failures: 0.
- Warnings: 0.
- Representative screenshots: 20.
- New content: 3 articles and 1 two-video library route.
- Content OS: 17 of 17 unit tests passed; all three article drafts retain Telegram provenance and both videos retain local-master provenance while remaining unapproved.
- Video delivery: both files are H.264/AAC at 720 × 1280; MP4 MIME, `Accept-Ranges`, and a 100-byte `206 Partial Content` request passed.
- Consent: fresh, deny, grant, revoke, and tampered/expired paths passed.
- External forms and analytics were intercepted; no live lead or analytics side
  effect was produced.
- `npm audit`: 0 vulnerabilities.

The machine-readable result is `scrollcraft/lab/planb-site/qa-report.json`. A failing local candidate exits non-zero and lists every violated contract.
