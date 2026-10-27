# Plan B full-site QA brief

## Purpose

This build verifies the approved dark Plan B visual system plus the expanded owned-content scope: seven article routes and a two-video library. Existing SEO metadata, legal history, consent behavior, lead payloads, and the separate Sokrat product surface remain protected.

The harness is local and side-effect-free. It never sends a lead, never loads live analytics code, and never changes production.

## Scope

- 62 marketing routes: homepage, service pages, company page, case routes, 39 blog routes (index plus 38 articles), video library and reviews page.
- 24 content routes with metadata validation independent of the baseline; exact list in `routes.mjs`.
- 15 self-hosted H.264/AAC videos (11 topical videos and four testimonials) with posters, Russian captions, source links, published-period context, and no autoplay.
- 5 current legal routes: rendered and checked, but kept free of analytics and motion code.
- 19 immutable files compared byte-for-byte with `/Users/konstantin/content-factory/planb-landing`:
  - 6 versioned legal documents;
  - 4 legacy redirect stubs;
  - 4 search-engine verification files;
  - 5 Sokrat files.

The exact lists live in `routes.mjs` and are explained in `ROUTES.md`.

## Acceptance boundary

A passing run means the local candidate satisfies the automated contracts at the tested Chromium viewports, including byte-range video delivery and content-specific structured data. It does not mean the site is deployed, that a live lead was delivered, or that real iPhone Safari and assistive-technology review have passed.

Before publication, the owner still reviews the whole site on a desktop and a phone. After publication, production needs a separate route/resource/readback check.

## Safety rules

- The Yandex Cloud lead endpoint is intercepted and answered locally.
- External analytics, font, and script requests are fulfilled with local empty responses.
- A seeded denied-consent record is used for ordinary rendering checks.
- Analytics grant/revoke behavior is tested without executing third-party code.
- The baseline worktree is read-only.
- This build writes evidence only to `scrollcraft/lab/planb-site/`.

Weekly website batch 2026-10-12: 4 new articles, 2 revisions; 32 canonical blog articles; 56 marketing / 61 active / 59 sitemap URLs. QA fixture lead route and current PD document hashes follow published Mac cutover fef7c180; analytics-consent archived snapshot remains independently pinned.

Weekly website batch 2026-10-19: 3 new articles, 3 revisions; 35 canonical blog articles; 59 marketing / 64 active / 62 sitemap URLs. Two already published Telegram videos are copied unchanged with local posters under the owner18Oct website-video instruction.

Weekly website batch 2026-10-27: 3 new articles, 1 revisions; 38 canonical blog articles; 62 marketing / 67 active / 65 sitemap URLs. One already published Telegram video is copied unchanged with a local poster under the owner18Oct website-video instruction.
