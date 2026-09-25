export const MARKETING_ROUTES = [
  "/",
  "/uslugi/vedenie-avito",
  "/uslugi/razovaya-nastroyka-avito",
  "/o-kompanii",
  "/kejsy/",
  "/kejsy/avtostekla",
  "/kejsy/buhgalterskie-uslugi",
  "/kejsy/doma-pod-klyuch",
  "/kejsy/metalloprokat",
  "/kejsy/naraschivanie-volos",
  "/kejsy/odin-den-stroitelnogo-proekta",
  "/kejsy/pokrytiya-dlya-dereva",
  "/kejsy/stroitel-7-regionov",
  "/kejsy/stroitelstvo-po-regionam",
  "/kejsy/stroyuslugi-god-k-godu",
  "/kejsy/tnvd-nasosy",
  "/kejsy/uslugi-massazha",
  "/kejsy/vrach-kosmetolog",
  "/kejsy/zapusk-stroitelnogo-akkaunta",
  "/blog/",
  "/blog/avtozagruzka-avito",
  "/blog/cheklist-zapuska-avito-s-nulya",
  "/blog/infografika-dlya-avito",
  "/blog/kak-masshtabirovat-akkaunt-avito",
  "/blog/kak-napisat-prodayushchee-obyavlenie-avito",
  "/blog/kak-podnyat-obyavlenie-v-top-avito",
  "/blog/kak-vybrat-avitologa",
  "/blog/oplata-za-prosmotry-avito",
  "/blog/otzyvy-na-avito",
  "/blog/pochemu-ne-rabotaet-prodvizhenie-avito",
  "/blog/pochemu-obyavlenie-ne-pokazyvaetsya-avito",
  "/blog/povedencheskie-faktory-avito",
  "/blog/prodvizhenie-avito-dlya-stroitelnyh-uslug",
  "/blog/skolko-obyavleniy-nuzhno-na-avito",
  "/blog/skolko-stoit-prodvizhenie-avito",
  "/blog/tarify-avito-2026",
  "/blog/uroven-servisa-avito",
  "/blog/vedenie-akkaunta-avito"
];

export const CURRENT_LEGAL_ROUTES = [
  "/rekvizity.html",
  "/oferta.html",
  "/privacy.html",
  "/consent-personal-data.html",
  "/consent-advertising.html"
];

export const ACTIVE_ROUTES = [...MARKETING_ROUTES, ...CURRENT_LEGAL_ROUTES];

export const REPRESENTATIVE_ROUTES = [
  "/",
  "/uslugi/vedenie-avito",
  "/o-kompanii",
  "/kejsy/",
  "/kejsy/metalloprokat",
  "/blog/",
  "/blog/vedenie-akkaunta-avito",
  "/privacy.html"
];

export const VERSIONED_LEGAL_FILES = [
  "legal/consent/planb-ads-2026-08-30-v1.html",
  "legal/consent/planb-pd-2026-08-30-v1.html",
  "legal/consent/planb-pd-2026-09-04-v2.html",
  "legal/offer/planb-offer-2026-08-30-v1.html",
  "legal/privacy/planb-privacy-2026-09-02-v2.html",
  "legal/privacy/planb-privacy-2026-09-04-v3.html"
];

export const REDIRECT_FILES = [
  "kejsy/rekord-47-zayavok-za-den.html",
  "kejsy/stroy-garant.html",
  "kejsy/stroymestr-s-nulya.html",
  "kejsy/woodcoat-himki.html"
];

export const REDIRECT_CONTRACTS = [
  {
    file: "kejsy/rekord-47-zayavok-za-den.html",
    source: "/kejsy/rekord-47-zayavok-za-den.html",
    target: "/kejsy/odin-den-stroitelnogo-proekta"
  },
  {
    file: "kejsy/stroy-garant.html",
    source: "/kejsy/stroy-garant.html",
    target: "/kejsy/stroitelstvo-po-regionam"
  },
  {
    file: "kejsy/stroymestr-s-nulya.html",
    source: "/kejsy/stroymestr-s-nulya.html",
    target: "/kejsy/zapusk-stroitelnogo-akkaunta"
  },
  {
    file: "kejsy/woodcoat-himki.html",
    source: "/kejsy/woodcoat-himki.html",
    target: "/kejsy/pokrytiya-dlya-dereva"
  }
];

export const VERIFICATION_FILES = [
  "google3de4065acce29c37.html",
  "googlea0629084bfd73e1b.html",
  "yandex_09a933844c004bc0.html",
  "yandex_e9cb0566a7467d09.html"
];

export const SOKRAT_FILES = [
  "sokrat.html",
  "sokrat-start.html",
  "sokrat-tarify.html",
  "sokrat-privacy.html",
  "sokrat-oferta.html"
];

export const IMMUTABLE_FILES = [
  ...VERSIONED_LEGAL_FILES,
  ...REDIRECT_FILES,
  ...VERIFICATION_FILES,
  ...SOKRAT_FILES
];

export const FORM_CONTRACTS = [
  {
    route: "/",
    selector: "#leadForm",
    status: "#leadMsg",
    phone: "#leadPhone",
    product: "planb_agency",
    routeValue: "agency_hub",
    landingVariant: "home_agency_v4",
    formId: "leadForm",
    successText: "Заявка принята",
    submittedScenario: "scale"
  },
  {
    route: "/uslugi/vedenie-avito",
    selector: "#serviceLead",
    status: "#serviceLeadMsg",
    phone: "#serviceLeadPhone",
    product: "planb_vedenie",
    routeValue: "vedenie",
    landingVariant: "service_vedenie_v4",
    formId: "serviceLead",
    successText: "Заявка принята"
  },
  {
    route: "/uslugi/razovaya-nastroyka-avito",
    selector: "#setupLead",
    status: "#setupLeadMsg",
    phone: "#setupLeadPhone",
    product: "planb_setup",
    routeValue: "razovaya_nastroyka",
    landingVariant: "service_setup_v1",
    formId: "serviceLead",
    successText: "Заявка принята"
  }
];

export function routeToRelativeFile(route) {
  const pathname = new URL(route, "https://planb-prodvizhenie.ru").pathname;
  if (pathname === "/") return "index.html";
  if (pathname.endsWith("/")) return pathname.slice(1) + "index.html";
  if (/\.[a-z0-9]+$/i.test(pathname)) return pathname.slice(1);
  return pathname.slice(1) + ".html";
}

export function expectedCanonical(route) {
  return new URL(route, "https://planb-prodvizhenie.ru").href;
}
