# Plan B full-site QA brief

## Purpose

This build verifies that the approved dark Plan B visual system can be applied to the complete agency site without changing routes, SEO metadata, legal history, consent behavior, lead payloads, or the separate Sokrat product surface.

The harness is local and side-effect-free. It never sends a lead, never loads live analytics code, and never changes production.

## Scope

- 38 marketing routes: homepage, two service pages, company page, 15 case routes, and 19 blog routes.
- 5 current legal routes: rendered and checked, but kept free of analytics and motion code.
- 19 immutable files compared byte-for-byte with `/Users/konstantin/content-factory/planb-landing`:
  - 6 versioned legal documents;
  - 4 legacy redirect stubs;
  - 4 search-engine verification files;
  - 5 Sokrat files.

The exact lists live in `routes.mjs` and are explained in `ROUTES.md`.

## Acceptance boundary

A passing run means the local candidate satisfies the automated contracts at the tested Chromium viewports. It does not mean the site is deployed, that a live lead was delivered, or that real iPhone Safari and assistive-technology review have passed.

Before publication, the owner still reviews the whole site on a desktop and a phone. After publication, production needs a separate route/resource/readback check.

## Safety rules

- The Yandex Cloud lead endpoint is intercepted and answered locally.
- External analytics, font, and script requests are fulfilled with local empty responses.
- A seeded denied-consent record is used for ordinary rendering checks.
- Analytics grant/revoke behavior is tested without executing third-party code.
- The baseline worktree is read-only.
- This build writes evidence only to `scrollcraft/lab/planb-site/`.
