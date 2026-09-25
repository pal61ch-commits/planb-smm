# Route and immutability contract

The executable source of truth is `routes.mjs`.

## Marketing routes: 42

- `/`
- `/o-kompanii`
- `/uslugi/vedenie-avito`
- `/uslugi/razovaya-nastroyka-avito`
- `/kejsy/` and 14 published case detail routes
- `/blog/` and 21 published article routes
- `/video/`

These routes must each load one consent loader, one Scrollcraft stylesheet/script pair, and one visual-system stylesheet/script pair. The homepage retains `home-depth`; the remaining 41 routes use `site-depth`.

The four content-pilot routes are `/video/`, `/blog/audit-akkaunta-avito-pered-prodvizheniem`, `/blog/stoimost-kontakta-na-avito`, and `/blog/statistika-avito-crm-sdelki`. They have their own metadata and structured-data contracts instead of a baseline copy.

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

The sitemap contains 45 URLs: the 42 marketing routes, `/sokrat`, `/rekvizity.html`, and `/oferta.html`. Privacy and consent documents remain reachable through site links but are intentionally excluded.
