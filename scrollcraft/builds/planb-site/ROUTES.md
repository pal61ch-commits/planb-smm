# Route and immutability contract

The executable source of truth is `routes.mjs`.

## Marketing routes: 62

- `/`
- `/o-kompanii`
- `/uslugi/vedenie-avito`
- `/uslugi/razovaya-nastroyka-avito`
- `/prodvizhenie-instagram`
- `/kejsy/` and 15 published case detail routes
- `/blog/` and 38 article routes
- `/video/` and `/otzyvy/`

These routes must each load one consent loader, one Scrollcraft stylesheet/script pair, and one visual-system stylesheet/script pair. The homepage retains `home-depth`; the remaining 61 marketing routes use `site-depth`.

The 24 new-content routes are:

- `/video/`
- `/otzyvy/`
- `/kejsy/yuridicheskie-uslugi`
- `/blog/agentstvo-ili-chastnyy-avitolog`
- `/blog/audit-akkaunta-avito-pered-prodvizheniem`
- `/blog/ii-prodavec-dlya-avito`
- `/blog/prodvizhenie-yuridicheskih-uslug-na-avito`
- `/blog/statistika-avito-crm-sdelki`
- `/blog/stoimost-kontakta-na-avito`
- `/blog/zakon-o-platformennoy-ekonomike-2026`

- `/blog/brif-dlya-avitologa`
- `/blog/sravnenie-tarifov-vedeniya-avito`
- `/prodvizhenie-instagram`
- `/blog/prodvizhenie-magazina-avtozapchastey-na-avito`

- `/blog/proverka-poziciy-avito-tri-zaprosa`
- `/blog/podklyuchenie-pifagor-profil-avito`
- `/blog/kejs-massazh-avito-kontakty-zapis`
- `/blog/agentstvo-avito-nepreryvnost-vedeniya`

- `/blog/kto-takoy-avitolog-kogda-nuzhen-biznesu`
- `/blog/posty-na-avito-lenta-dlya-biznesa`
- `/blog/agentstva-avito-analitika-avtomatizaciya`

- `/blog/bonusy-avito-uslugi-proverka-usloviy`
- `/blog/kejs-skrytye-karnizy-avito-69-899-kontaktov`
- `/blog/kak-proverit-keysy-avito-agentstva`

They have their own metadata and structured-data contracts instead of a baseline copy.

Fifteen existing client-question articles were substantially revised on 6 October
2026 under the owner's explicit publication instruction. Their precise changed
title, description and JSON-LD fields are declared per route in the existing
`BASELINE_DRIFT_ALLOWLIST`; canonical equality and all other checks still apply.

## Current legal routes: 5

- `/rekvizity.html`
- `/oferta.html`
- `/privacy.html`
- `/consent-personal-data.html`
- `/consent-advertising.html`

They load `legal-depth.css` once and do not load Scrollcraft or analytics.

## Immutable baseline comparison: 19 files

### Versioned legal documents: 6

- `legal/consent/planb-ads-2026-08-30-v1.html`
- `legal/consent/planb-pd-2026-08-30-v1.html`
- `legal/consent/planb-pd-2026-09-04-v2.html`
- `legal/offer/planb-offer-2026-08-30-v1.html`
- `legal/privacy/planb-privacy-2026-09-02-v2.html`
- `legal/privacy/planb-privacy-2026-09-04-v3.html`

### Legacy redirects: 4

- `kejsy/rekord-47-zayavok-za-den.html`
- `kejsy/stroy-garant.html`
- `kejsy/stroymestr-s-nulya.html`
- `kejsy/woodcoat-himki.html`

### Search verification: 4

- `google3de4065acce29c37.html`
- `googlea0629084bfd73e1b.html`
- `yandex_09a933844c004bc0.html`
- `yandex_e9cb0566a7467d09.html`

### Separate Sokrat surface: 5

- `sokrat.html`
- `sokrat-start.html`
- `sokrat-tarify.html`
- `sokrat-privacy.html`
- `sokrat-oferta.html`

Sokrat remains outside this redesign. Its application API, auth, payment, analytics, and tool flows require their own release gate.

## Sitemap contract

The expected sitemap contains 65 URLs: the 62 marketing routes, `/sokrat`, `/rekvizity.html`, and `/oferta.html`. Privacy and consent documents remain reachable through site links but are intentionally excluded.

Weekly website batch 2026-10-12: 4 new articles, 2 revisions; 32 canonical blog articles; 56 marketing / 61 active / 59 sitemap URLs. QA fixture lead route and current PD document hashes follow published Mac cutover fef7c180; analytics-consent archived snapshot remains independently pinned.

Weekly website batch 2026-10-19: 3 new articles, 3 revisions; 35 canonical blog articles; 59 marketing / 64 active / 62 sitemap URLs. Two already published Telegram videos are copied unchanged with local posters under the owner18Oct website-video instruction.

Weekly website batch 2026-10-27: 3 new articles, 1 revisions; 38 canonical blog articles; 62 marketing / 67 active / 65 sitemap URLs. One already published Telegram video is copied unchanged with a local poster under the owner18Oct website-video instruction.
