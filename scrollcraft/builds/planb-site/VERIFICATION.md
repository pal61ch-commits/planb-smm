# Verification record

## Harness implementation

- Status: implemented locally; not a production check.
- Candidate root: `/Users/konstantin/content-factory/planb-landing-scrollcraft-home`
- Baseline root: `/Users/konstantin/content-factory/planb-landing`
- Browser: local Google Chrome through `playwright-core` 1.58.2.
- Evidence directory: `scrollcraft/lab/planb-site/`.

## Implemented gates

- Exact route and immutable-file counts.
- SHA-256 comparison with the baseline worktree.
- GitHub Pages-like extensionless route server.
- Static SEO, JSON-LD, assets, sitemap, internal links, and fragment contracts.
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

## Latest run

- Completed: 2026-09-25 09:24:00 UTC.
- Verdict: **PASS**.
- Active routes: 43 of 43.
- Browser runs: 134.
- Form runs: 6, covering local success and failure responses for all three forms.
- Redirect runs: 4 of 4.
- Immutable baseline comparisons: 19 of 19 unchanged.
- Failures: 0.
- Warnings: 0.
- Representative screenshots: 16.
- Consent: fresh, deny, grant, revoke, and tampered/expired paths passed.
- External forms and analytics were intercepted; no live lead or analytics side
  effect was produced.
- `npm audit`: 0 vulnerabilities.

The machine-readable result is `scrollcraft/lab/planb-site/qa-report.json`. A failing local candidate exits non-zero and lists every violated contract.
