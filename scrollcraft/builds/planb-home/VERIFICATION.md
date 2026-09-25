# Verification

Status: **local candidate PASS; production is not deployed**.

## Automated browser QA

The local Playwright harness completed with no failures:

- desktop: 1440 × 900;
- laptop: 1280 × 720;
- mobile: 390 × 844;
- compact mobile: 360 × 640;
- reduced motion: 390 × 844;
- JavaScript-disabled fallback: 390 × 844.

Checks covered:

- no horizontal overflow;
- one Scrollcraft instance and three hero signal planes;
- all viewport reveals settle visibly;
- mobile navigation opens and closes with the expected ARIA state;
- keyboard traversal reaches only visible targets and shows a focus outline;
- reduced-motion holds the signal scene with no running pulse animation;
- no-JS keeps all copy and the lead form visible;
- no broken images, missing anchors, console errors, request failures or HTTP
  errors;
- lead-form identity, required fields, status region and versioned privacy
  fields are unchanged.

Evidence:

- scrollcraft/lab/home-clean/qa-report.json
- scrollcraft/lab/home-clean/desktop-hero.png
- scrollcraft/lab/home-clean/mobile-hero.png
- scrollcraft/lab/home-clean/mobile-contact.png

## Official Scrollcraft shoot

The official harness passed without dead scroll in the final runs:

- desktop 1440 × 900: home-official-desktop-v2;
- mobile 390 × 844: home-official-mobile-v2;
- reduced motion 390 × 844: home-official-reduced-v2.

An initial normal-motion run reported dead scroll between the hero and page end
because the bespoke whole-page progress was visible but not published to the
harness. The progress bar now publishes its real page percentage through
data-sc-verify-state. The final desktop, mobile and reduced-motion runs all
report “no dead scroll detected”.

## Static and dependency checks

- JSON-LD parses successfully.
- All 23 local href/src targets map to tracked files.
- Scrollcraft vendor hashes match the audited upstream commit.
- JavaScript syntax and git diff whitespace checks pass.
- npm audit: 0 vulnerabilities.
- Vendor plus page-specific CSS/JS: 31,588 bytes gzip, below the 35 KB ceiling.

## Visual feel check

Intended: controlled depth, one clear yellow signal, strong first-screen
hierarchy and no invented dashboard data.

Observed: the hero reads as one spatial system instead of a card stack; the warm
editorial sections give the long page relief; the final form stays calm and
legible. The redundant “project control” section and the extra hero readout were
removed after visual review.

## Remaining manual gates

- Real iPhone Safari has not been checked.
- The external lead endpoint was not submitted during local QA.
- GitHub Pages build and live readback remain pending because publication needs
  separate owner approval.
