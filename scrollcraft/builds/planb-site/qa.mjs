import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import {
  ACTIVE_ROUTES,
  CURRENT_LEGAL_ROUTES,
  FORM_CONTRACTS,
  IMMUTABLE_FILES,
  MARKETING_ROUTES,
  NEW_CONTENT_ROUTES,
  REDIRECT_CONTRACTS,
  REPRESENTATIVE_ROUTES,
  SOKRAT_FILES,
  VERIFICATION_FILES,
  VERSIONED_LEGAL_FILES,
  expectedCanonical,
  routeToRelativeFile
} from "./routes.mjs";
import { DEFAULT_ROOT, resolveRequestPath, startServer } from "./server.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(process.env.PLANB_SITE_ROOT || DEFAULT_ROOT);
const BASELINE_ROOT = path.resolve(process.env.PLANB_BASELINE_ROOT || "/Users/konstantin/content-factory/planb-landing");
// Historical SEO expectations and current protected assets can have different
// release baselines (for example an independently shipped Sokrat page).
const SEO_BASELINE_ROOT = path.resolve(process.env.PLANB_SEO_BASELINE_ROOT || BASELINE_ROOT);
const CHROME = process.env.SCROLLCRAFT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.resolve(HERE, "../../lab/planb-site");
const SCREENSHOTS = path.join(OUT, "screenshots");
const LEAD_HOST = "functions.yandexcloud.net";
const LEAD_PATH = "/d4egi8sqig8ak86v89jg";
const CONSENT_KEY = "planb_analytics_consent_v3";
const CONSENT_SCHEMA = "planb-analytics-choice-v3";
const CONSENT_VERSION = "planb-analytics-2026-09-29-v3";
const ATTRIBUTION_KEY = "planb_session_attribution_v1";
const PRIVACY_VERSION = "planb-privacy-2026-09-29-v4";
const PRIVACY_SHA256 = "455d7155c3aa47424bb66daee7e8dd2492532a30c567e5f84e8634bbe853ee83";
const NOTICE_SHA256 = "567a90210a2d829edccf7b977e7727a4c0fd4b2e2b294826f4ccd574f2916270";
const CURRENT_LEGAL_EVIDENCE = new Map([
  ["legal/privacy/planb-privacy-2026-09-29-v4.html", PRIVACY_SHA256],
  ["legal/analytics-consent/planb-analytics-notice-2026-09-29-v3.txt", NOTICE_SHA256]
]);
const HISTORICAL_CASE_ROUTES = [
  "/kejsy/avtostekla",
  "/kejsy/buhgalterskie-uslugi",
  "/kejsy/doma-pod-klyuch",
  "/kejsy/naraschivanie-volos",
  "/kejsy/pokrytiya-dlya-dereva",
  "/kejsy/stroitel-7-regionov",
  "/kejsy/stroitelstvo-po-regionam",
  "/kejsy/stroyuslugi-god-k-godu",
  "/kejsy/tnvd-nasosy",
  "/kejsy/uslugi-massazha",
  "/kejsy/vrach-kosmetolog",
  "/kejsy/zapusk-stroitelnogo-akkaunta"
];
const BASELINE_DRIFT_FIELDS = new Set(["title", "description", "jsonld"]);
const BASELINE_DRIFT_ALLOWLIST = new Map([
  ["/blog/", new Set(["jsonld"])],
  ["/video/", new Set(["description", "jsonld"])],
  ["/kejsy/", new Set(["title", "description", "jsonld"])],
  ["/kejsy/metalloprokat", new Set(["title", "description", "jsonld"])],
  ["/kejsy/odin-den-stroitelnogo-proekta", new Set(["title", "description", "jsonld"])],
  ...HISTORICAL_CASE_ROUTES.map(route => [route, new Set(["title", "description", "jsonld"])])
]);
const CASE_INDEX_URLS = [
  "https://planb-prodvizhenie.ru/kejsy/odin-den-stroitelnogo-proekta",
  "https://planb-prodvizhenie.ru/kejsy/metalloprokat",
  "https://planb-prodvizhenie.ru/kejsy/yuridicheskie-uslugi",
  "https://planb-prodvizhenie.ru/kejsy/avtostekla",
  "https://planb-prodvizhenie.ru/kejsy/tnvd-nasosy",
  "https://planb-prodvizhenie.ru/kejsy/vrach-kosmetolog",
  "https://planb-prodvizhenie.ru/kejsy/stroyuslugi-god-k-godu",
  "https://planb-prodvizhenie.ru/kejsy/doma-pod-klyuch",
  "https://planb-prodvizhenie.ru/kejsy/stroitelstvo-po-regionam#rezultat-154-539",
  "https://planb-prodvizhenie.ru/kejsy/pokrytiya-dlya-dereva#rezultat-woodcoat",
  "https://planb-prodvizhenie.ru/kejsy/stroitel-7-regionov",
  "https://planb-prodvizhenie.ru/kejsy/odin-den-stroitelnogo-proekta#arhiv-16-iyunya",
  "https://planb-prodvizhenie.ru/kejsy/buhgalterskie-uslugi",
  "https://planb-prodvizhenie.ru/kejsy/naraschivanie-volos",
  "https://planb-prodvizhenie.ru/kejsy/uslugi-massazha",
  "https://planb-prodvizhenie.ru/kejsy/metalloprokat#arhiv-noyabr",
  "https://planb-prodvizhenie.ru/kejsy/zapusk-stroitelnogo-akkaunta#rezultat-245"
];
const REAL_CASE_CONTRACTS = new Map([
  ["/kejsy/odin-den-stroitelnogo-proekta", {
    proof: "media/cases/avito-stroitelstvo-23-kontakta-proof.png",
    metrics: ["23 Контакта", "56 просмотров", "4 815", "209,3"],
    figures: 2
  }],
  ["/kejsy/metalloprokat", {
    proof: "media/cases/avito-metalloprokat-126-kontaktov-proof.png",
    metrics: ["126 Контактов", "1 835", "132,9", "17 августа", "2 сентября"],
    figures: 2
  }],
  ["/kejsy/yuridicheskie-uslugi", {
    proof: "media/cases/avito-yuridicheskie-uslugi-60-kontaktov-proof.png",
    metrics: ["60 Контактов", "543 просмотра", "11%", "167", "15–22 сентября"],
    figures: 1
  }]
]);
const HISTORICAL_CASE_CONTRACTS = new Map([
  ["/kejsy/avtostekla", { proof: "media/cases/history/avtostekla-before-after.jpg", metrics: ["5 010", "13 893", "6 478", "50,9 ₽"] }],
  ["/kejsy/tnvd-nasosy", { proof: "media/cases/history/tnvd-periods.jpg", metrics: ["1 154", "27 773", "2 338", "3 505"] }],
  ["/kejsy/vrach-kosmetolog", { proof: "media/cases/history/vrach-kosmetolog-may-june.jpg", metrics: ["110 Контактов", "3 120", "552", "130,8 ₽"] }],
  ["/kejsy/stroyuslugi-god-k-godu", { proof: "media/cases/history/stroyuslugi-may-comparison.jpg", metrics: ["78 → 480", "1 072 → 2 899", "1 039,5 → 524,5 ₽"] }],
  ["/kejsy/doma-pod-klyuch", { proof: "media/cases/history/doma-may-june.jpg", metrics: ["325 Контактов", "23 109", "1 650", "210,7 ₽"] }],
  ["/kejsy/stroitelstvo-po-regionam", { proof: "media/cases/history/stroy-garant-two-periods.jpg", metrics: ["154 → 539", "1 025 → 4 370", "382,2 → 155,3 ₽"], anchor: "rezultat-154-539" }],
  ["/kejsy/pokrytiya-dlya-dereva", { proof: "media/cases/history/woodcoat-may-june.jpg", metrics: ["13 → 54", "461 → 1 776", "1 136,3 → 595,2 ₽"], anchor: "rezultat-woodcoat" }],
  ["/kejsy/stroitel-7-regionov", { proof: "media/cases/history/stroitel-7-regionov-may-june.jpg", metrics: ["266 Контактов", "1 631", "210", "433,5 ₽"] }],
  ["/kejsy/buhgalterskie-uslugi", { proof: "media/cases/history/buhgalteriya-july-october.jpg", metrics: ["37 → 135", "306 → 1 175", "37 → 486"] }],
  ["/kejsy/naraschivanie-volos", { proof: "media/cases/history/volosy-jan-feb.jpg", metrics: ["618 просмотров", "332", "10,89 ₽"] }],
  ["/kejsy/uslugi-massazha", { proof: "media/cases/history/massage-feb-march.jpg", metrics: ["17 Контактов", "962", "181"] }],
  ["/kejsy/zapusk-stroitelnogo-akkaunta", { proof: "media/cases/history/stroymestr-march-april.jpg", metrics: ["245 Контактов", "1 619", "194", "244,5 ₽"], anchor: "rezultat-245" }]
]);
const CASE_DETAIL_ROUTES = [...HISTORICAL_CASE_CONTRACTS.keys(), ...REAL_CASE_CONTRACTS.keys()];
const HISTORY_PROOF_FILES = [
  ...[...HISTORICAL_CASE_CONTRACTS.values()].map(contract => contract.proof),
  "media/cases/history/stroitelstvo-june-16.jpg",
  "media/cases/history/metalloprokat-november.jpg"
];

const failures = [];
const warnings = [];
const report = {
  generatedAt: new Date().toISOString(),
  siteRoot: SITE_ROOT,
  baselineRoot: BASELINE_ROOT,
  seoBaselineRoot: SEO_BASELINE_ROOT,
  scope: {
    marketing: MARKETING_ROUTES.length,
    currentLegal: CURRENT_LEGAL_ROUTES.length,
    immutable: IMMUTABLE_FILES.length,
    active: ACTIVE_ROUTES.length
  },
  static: {},
  profiles: [],
  contactStability: [],
  forms: [],
  consent: {},
  redirects: [],
  failures,
  warnings
};

function check(ok, code, details = "") {
  if (!ok) failures.push(details ? `${code}: ${details}` : code);
  return ok;
}

function warn(code, details = "") {
  warnings.push(details ? `${code}: ${details}` : code);
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

function tagContent(html, tag) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const nameMatch = tag.match(/\bname=["']([^"']+)["']/i);
    if (!nameMatch || nameMatch[1].toLowerCase() !== name.toLowerCase()) continue;
    return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || "";
  }
  return "";
}

function canonicalHref(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] || "";
    if (!rel.toLowerCase().split(/\s+/).includes("canonical")) continue;
    return tag.match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
  }
  return "";
}

function jsonLdValues(html) {
  const values = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html))) values.push(JSON.parse(match[1]));
  return values;
}

function jsonLdTypes(values) {
  const types = [];
  for (const value of values) {
    const nodes = value && Array.isArray(value["@graph"]) ? value["@graph"] : [value];
    for (const node of nodes) {
      const nodeTypes = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
      types.push(...nodeTypes.filter(Boolean));
    }
  }
  return types;
}

function normalizeJson(value) {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalizeJson(value[key])]));
  }
  return value;
}

function extractAnchors(html) {
  const anchors = [];
  const regex = /<a\b([^>]*)>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const attrs = match[1];
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    anchors.push({
      href: href.replaceAll("&amp;", "&"),
      target: attrs.match(/\btarget=["']([^"']+)["']/i)?.[1] || "",
      rel: attrs.match(/\brel=["']([^"']+)["']/i)?.[1] || ""
    });
  }
  return anchors;
}

function hasId(html, fragment) {
  const decoded = decodeURIComponent(fragment.replace(/^#/, ""));
  if (!decoded) return true;
  const escaped = decoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\bid=["']${escaped}["']`, "i").test(html);
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function digest(file) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

async function pngDimensions(file) {
  const bytes = await fs.readFile(file);
  if (bytes.length < 24 || bytes.subarray(1, 4).toString("ascii") !== "PNG") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function jpegDimensions(file) {
  const bytes = await fs.readFile(file);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += length + 2;
  }
  return null;
}

async function seedDeniedConsent(context) {
  await context.addInitScript(({ key, schema, version, privacyVersion, privacyHash, noticeHash }) => {
    const now = Date.now();
    localStorage.setItem(key, JSON.stringify({
      schema,
      version,
      privacy_version: privacyVersion,
      privacy_sha256: privacyHash,
      notice_sha256: noticeHash,
      choice: "denied",
      decided_at: new Date(now).toISOString(),
      expires_at: now + 180 * 24 * 60 * 60 * 1000
    }));
  }, {
    key: CONSENT_KEY,
    schema: CONSENT_SCHEMA,
    version: CONSENT_VERSION,
    privacyVersion: PRIVACY_VERSION,
    privacyHash: PRIVACY_SHA256,
    noticeHash: NOTICE_SHA256
  });
}

function fulfilledExternal(request) {
  const type = request.resourceType();
  if (type === "stylesheet") return { status: 200, contentType: "text/css; charset=utf-8", body: "" };
  if (type === "script") return { status: 200, contentType: "text/javascript; charset=utf-8", body: "void 0;" };
  if (type === "xhr" || type === "fetch") return { status: 200, contentType: "application/json; charset=utf-8", body: "{}" };
  return { status: 204, body: "" };
}

function screenshotName(route) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/\/$/, "-index").replace(/[^a-z0-9]+/gi, "-");
}

async function staticAudit() {
  check(MARKETING_ROUTES.length === 51, "scope.marketing", `expected 51, got ${MARKETING_ROUTES.length}`);
  check(CURRENT_LEGAL_ROUTES.length === 5, "scope.current-legal", `expected 5, got ${CURRENT_LEGAL_ROUTES.length}`);
  check(VERSIONED_LEGAL_FILES.length === 6, "scope.versioned-legal", `expected 6, got ${VERSIONED_LEGAL_FILES.length}`);
  check(REDIRECT_CONTRACTS.length === 4, "scope.redirects", `expected 4, got ${REDIRECT_CONTRACTS.length}`);
  check(VERIFICATION_FILES.length === 4, "scope.verification", `expected 4, got ${VERIFICATION_FILES.length}`);
  check(SOKRAT_FILES.length === 5, "scope.sokrat", `expected 5, got ${SOKRAT_FILES.length}`);
  check(new Set(ACTIVE_ROUTES).size === ACTIVE_ROUTES.length, "scope.active-duplicates");
  check(new Set(IMMUTABLE_FILES).size === IMMUTABLE_FILES.length, "scope.immutable-duplicates");
  for (const [route, fields] of BASELINE_DRIFT_ALLOWLIST) {
    check(ACTIVE_ROUTES.includes(route), "baseline.allowlist-route", route);
    check([...fields].every(field => BASELINE_DRIFT_FIELDS.has(field)), "baseline.allowlist-field", `${route}: ${[...fields].join(", ")}`);
  }

  const immutable = [];
  for (const relative of IMMUTABLE_FILES) {
    const candidate = path.join(SITE_ROOT, relative);
    const baseline = path.join(BASELINE_ROOT, relative);
    const candidateExists = await exists(candidate);
    const baselineExists = await exists(baseline);
    check(candidateExists, "immutable.missing-candidate", relative);
    check(baselineExists, "immutable.missing-baseline", relative);
    if (!candidateExists || !baselineExists) continue;
    const actual = await digest(candidate);
    const expected = await digest(baseline);
    check(actual === expected, "immutable.changed", `${relative} expected ${expected}, got ${actual}`);
    immutable.push({ file: relative, expected, actual, unchanged: actual === expected });
  }

  const currentLegalEvidence = [];
  for (const [relative, expected] of CURRENT_LEGAL_EVIDENCE) {
    const candidate = path.join(SITE_ROOT, relative);
    const candidateExists = await exists(candidate);
    check(candidateExists, "legal.current-evidence-missing", relative);
    if (!candidateExists) continue;
    const actual = await digest(candidate);
    check(actual === expected, "legal.current-evidence-hash", `${relative} expected ${expected}, got ${actual}`);
    currentLegalEvidence.push({ file: relative, expected, actual, valid: actual === expected });
  }
  const currentPrivacy = path.join(SITE_ROOT, "privacy.html");
  if (await exists(currentPrivacy)) {
    const actual = await digest(currentPrivacy);
    check(actual === PRIVACY_SHA256, "legal.current-privacy-hash", `privacy.html expected ${PRIVACY_SHA256}, got ${actual}`);
  }
  const active = [];
  const localLinkFailures = [];
  for (const route of ACTIVE_ROUTES) {
    const relative = routeToRelativeFile(route);
    const candidate = path.join(SITE_ROOT, relative);
    const baseline = path.join(SEO_BASELINE_ROOT, relative);
    const candidateExists = await exists(candidate);
    const baselineExists = await exists(baseline);
    check(candidateExists, "active.missing-candidate", `${route} -> ${relative}`);
    if (!NEW_CONTENT_ROUTES.includes(route)) {
      check(baselineExists, "active.missing-baseline", `${route} -> ${relative}`);
    }
    if (!candidateExists) continue;
    const html = await fs.readFile(candidate, "utf8");
    const marketing = MARKETING_ROUTES.includes(route);
    const expected = expectedCanonical(route);

    check(tagContent(html, "title").length > 0, "seo.title", route);
    check(metaContent(html, "description").length > 0, "seo.description", route);
    check(canonicalHref(html) === expected, "seo.canonical", `${route} expected ${expected}, got ${canonicalHref(html)}`);

    let values = [];
    try {
      values = jsonLdValues(html);
      if (marketing) check(values.length >= 1, "seo.jsonld-missing", route);
    } catch (error) {
      check(false, "seo.jsonld-invalid", `${route}: ${error.message}`);
    }

    if (baselineExists) {
      const baselineHtml = await fs.readFile(baseline, "utf8");
      const allowedDrift = BASELINE_DRIFT_ALLOWLIST.get(route) || new Set();
      const actualTitle = tagContent(html, "title");
      const baselineTitle = tagContent(baselineHtml, "title");
      const titleChanged = actualTitle !== baselineTitle;
      const actualDescription = metaContent(html, "description");
      const baselineDescription = metaContent(baselineHtml, "description");
      const descriptionChanged = actualDescription !== baselineDescription;
      if (allowedDrift.has("title")) check(titleChanged, "baseline.allowlist-stale", `${route}: title`);
      else check(!titleChanged, "seo.title-drift", route);
      if (allowedDrift.has("description")) check(descriptionChanged, "baseline.allowlist-stale", `${route}: description`);
      else check(!descriptionChanged, "seo.description-drift", route);
      check(canonicalHref(html) === canonicalHref(baselineHtml), "seo.canonical-drift", route);
      try {
        const actualJson = JSON.stringify(normalizeJson(values));
        const baselineValues = jsonLdValues(baselineHtml);
        if (route === "/") {
          const organization = baselineValues
            .flatMap(value => value && Array.isArray(value["@graph"]) ? value["@graph"] : [value])
            .find(node => node?.["@id"] === "https://planb-prodvizhenie.ru/#business");
          if (organization) {
            organization.sameAs = [
              "https://www.instagram.com/avitolog_planb_prodvizenie/",
              "https://vk.ru/planb_avitolog",
              "https://t.me/planB_prodvizhenie"
            ];
          }
        }
        const baselineJson = JSON.stringify(normalizeJson(baselineValues));
        const jsonChanged = actualJson !== baselineJson;
        if (allowedDrift.has("jsonld")) check(jsonChanged, "baseline.allowlist-stale", `${route}: jsonld`);
        else check(!jsonChanged, "seo.jsonld-drift", route);
      } catch (error) {
        check(false, "seo.jsonld-baseline", `${route}: ${error.message}`);
      }
    }

    const types = jsonLdTypes(values);
    if (route === "/") {
      const socialCards = html.match(/<a\b[^>]*class="[^"]*\bsocial-card\b[^"]*"[^>]*>/gi) || [];
      const socialURLs = [
        "https://www.instagram.com/avitolog_planb_prodvizenie/",
        "https://t.me/planB_prodvizhenie",
        "https://vk.ru/planb_avitolog"
      ];
      check(socialCards.length === 3, "home.social-card-count", `expected 3, got ${socialCards.length}`);
      for (const socialURL of socialURLs) {
        check(socialCards.some(tag => tag.includes(`href="${socialURL}"`)), "home.social-card-link", socialURL);
      }
      const freeConsultationCopy = "Получить бесплатную консультацию и план продвижения";
      const conversionCandidate = html.includes('<body class="cro-home">');
      check(count(html, freeConsultationCopy) >= (conversionCandidate ? 1 : 2), "home.free-consultation-copy", `expected primary CTA: ${freeConsultationCopy}`);
      if (conversionCandidate) {
        check(html.includes("Консультация + план · бесплатно"), "home.free-consultation-heading");
        check(count(html, 'class="proof-card reveal"') === 3, "home.real-proof-card-count");
        check(html.includes('href="#leadForm"'), "home.direct-form-anchor");
        check(html.includes('class="optional-fields"'), "home.optional-details");
        check(html.indexOf('id="cases"') < html.indexOf('id="services"'), "home.proof-before-process");
      } else {
        check(html.includes("Получите бесплатную консультацию и план продвижения"), "home.free-consultation-heading");
      }
      check(html.includes("Получить бесплатную консультацию и план</button>"), "home.free-consultation-submit");
    }
    if (NEW_CONTENT_ROUTES.includes(route) && route.startsWith("/blog/")) {
      for (const type of ["BlogPosting", "FAQPage", "BreadcrumbList"]) {
        check(types.includes(type), "seo.article-schema", `${route}: missing ${type}`);
      }
    }
    if (CASE_DETAIL_ROUTES.includes(route)) {
      const primaryNav = html.match(/<nav\b[^>]*class=["'][^"']*\bnav\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] || "";
      const requiredItems = ["Услуги", "Кейсы", "Блог", "Видео", "Отзывы", "Контакты", "Получить разбор"];
      check(primaryNav.includes("nav--complete"), "cases.detail-full-nav-class", route);
      check(requiredItems.every(item => primaryNav.includes(`>${item}</a>`)), "cases.detail-full-nav-items", `${route}: ${requiredItems.filter(item => !primaryNav.includes(`>${item}</a>`)).join(", ")}`);
      check(/href=["']\/kejsy\/["'][^>]*aria-current=["']page["']|aria-current=["']page["'][^>]*href=["']\/kejsy\/["']/i.test(primaryNav), "cases.detail-nav-current", route);
      check(!primaryNav.includes(">Сократ</a>"), "cases.detail-legacy-nav", route);
    }
    if (route === "/kejsy/") {
      check(types.includes("CollectionPage") && types.includes("ItemList") && types.includes("BreadcrumbList"), "cases.index-schema", types.join(", "));
      const nodes = values.flatMap(value => value && Array.isArray(value["@graph"]) ? value["@graph"] : [value]);
      const list = nodes.find(node => node?.["@id"] === "https://planb-prodvizhenie.ru/kejsy/#cases");
      const listed = (list?.itemListElement || []).map(item => item?.url || item?.item?.url || item?.item?.["@id"]).filter(Boolean);
      check(list?.numberOfItems === 17 && listed.length === 17, "cases.index-count", JSON.stringify(list));
      check(CASE_INDEX_URLS.every(url => listed.includes(url)) && listed.every(url => CASE_INDEX_URLS.includes(url)), "cases.index-urls", JSON.stringify(listed));
      check(count(html, "case-feature-card glass") === 17, "cases.index-card-count", String(count(html, "case-feature-card glass")));
      check(count(html, "/media/cases/history/") === 14, "cases.index-history-proof-count", String(count(html, "/media/cases/history/")));
      check(!html.includes("scenario-section") && !/сценари[йия]/i.test(html), "cases.index-no-scenarios");
      check(!/(?:заявк|\bлид(?:ы|ов|а|у|ом|ами)?\b)/iu.test(html), "cases.index-contact-terminology");
      for (const proof of HISTORY_PROOF_FILES) {
        const file = path.join(SITE_ROOT, proof);
        check(await exists(file), "cases.history-proof-file", proof);
        if (await exists(file)) {
          const dimensions = await jpegDimensions(file);
          check(dimensions?.width === 1000 && dimensions?.height === 600, "cases.history-proof-dimensions", `${proof}: ${JSON.stringify(dimensions)}`);
        }
      }
    }
    const caseContract = REAL_CASE_CONTRACTS.get(route);
    if (caseContract) {
      check(types.includes("Article") && types.includes("BreadcrumbList"), "cases.detail-schema", `${route}: ${types.join(", ")}`);
      const nodes = values.flatMap(value => value && Array.isArray(value["@graph"]) ? value["@graph"] : [value]);
      const article = nodes.find(node => (Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]).includes("Article"));
      const proofUrl = `https://planb-prodvizhenie.ru/${caseContract.proof}`;
      check(article?.mainEntityOfPage === expectedCanonical(route), "cases.main-entity", `${route}: ${article?.mainEntityOfPage}`);
      check(article?.image === proofUrl && article?.dateModified === "2026-09-29", "cases.article-proof", `${route}: ${JSON.stringify(article)}`);
      check(count(html, '<figure class="case-evidence">') === caseContract.figures, "cases.evidence-figure", `${route}: ${count(html, '<figure class="case-evidence">')}`);
      check(html.includes(`src="/${caseContract.proof}"`) && html.includes('loading="lazy"'), "cases.evidence-image", route);
      check(caseContract.metrics.every(metric => html.includes(metric)), "cases.metrics", `${route}: ${caseContract.metrics.filter(metric => !html.includes(metric)).join(", ")}`);
      check(html.includes("case-provenance") && html.includes("Ограничение результата") && html.includes("не подтверждённая сделка"), "cases.provenance-limit", route);
      for (const rawName of ["avito-stats-andrey-final.png", "avito-metal-stats.png", "avito-legal-stats.png"]) {
        check(!html.includes(rawName), "cases.raw-proof-reference", `${route}: ${rawName}`);
      }
      const proofFile = path.join(SITE_ROOT, caseContract.proof);
      check(await exists(proofFile), "cases.proof-file", caseContract.proof);
      if (await exists(proofFile)) {
        const dimensions = await pngDimensions(proofFile);
        check(dimensions?.width === 1000 && dimensions?.height === 600, "cases.proof-dimensions", `${caseContract.proof}: ${JSON.stringify(dimensions)}`);
      }
    }
    const historicalContract = HISTORICAL_CASE_CONTRACTS.get(route);
    if (historicalContract) {
      check(types.includes("Article") && types.includes("BreadcrumbList"), "cases.history-detail-schema", `${route}: ${types.join(", ")}`);
      const nodes = values.flatMap(value => value && Array.isArray(value["@graph"]) ? value["@graph"] : [value]);
      const article = nodes.find(node => (Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]).includes("Article"));
      const proofUrl = `https://planb-prodvizhenie.ru/${historicalContract.proof}`;
      check(article?.mainEntityOfPage === expectedCanonical(route), "cases.history-main-entity", `${route}: ${article?.mainEntityOfPage}`);
      check(article?.image === proofUrl && article?.dateModified === "2026-09-29", "cases.history-article-proof", `${route}: ${JSON.stringify(article)}`);
      check(count(html, '<figure class="case-evidence">') === 1, "cases.history-evidence-figure", route);
      check(html.includes(`src="/${historicalContract.proof}"`), "cases.history-evidence-image", route);
      check(historicalContract.metrics.every(metric => html.includes(metric)), "cases.history-metrics", `${route}: ${historicalContract.metrics.filter(metric => !html.includes(metric)).join(", ")}`);
      check(html.includes("Ограничение результата") && html.includes("Детерминированный фрагмент"), "cases.history-proof-context", route);
      check(!/сценари[йия]/i.test(html) && !/(?:заявк|\bлид(?:ы|ов|а|у|ом|ами)?\b)/iu.test(html), "cases.history-terminology", route);
      if (historicalContract.anchor) check(hasId(html, `#${historicalContract.anchor}`), "cases.history-anchor", `${route}#${historicalContract.anchor}`);
    }
    const videoTags = html.match(/<video\b[^>]*>/gi) || [];
    if (videoTags.length) {
      check(videoTags.every(tag => /\baria-(?:label|labelledby)=/i.test(tag)), "a11y.video-name", route);
      check(!/<video\b[^>]*\bautoplay\b/i.test(html), "video.autoplay", route);
      check(!/<track\b[^>]*\bdefault\b/i.test(html), "video.captions-default", route);
    }
    if (route === "/video/") {
      check(types.includes("CollectionPage"), "seo.video-schema", `${route}: missing CollectionPage`);
      check(types.includes("ItemList"), "seo.video-schema", `${route}: missing ItemList`);
      check(types.filter(type => type === "VideoObject").length === 8, "seo.video-count", route);
      const videoNodes = values.flatMap(value => value && Array.isArray(value["@graph"]) ? value["@graph"] : [value]);
      const videoList = videoNodes.find(node => node?.["@id"] === "https://planb-prodvizhenie.ru/video/#list");
      const legalVideo = videoNodes.find(node => node?.["@id"] === "https://planb-prodvizhenie.ru/video/#yuridicheskie-uslugi");
      check(videoList?.numberOfItems === 8 && videoList?.itemListElement?.length === 8, "seo.video-list-count", route);
      check(legalVideo?.sameAs?.includes("https://t.me/planB_prodvizhenie/724"), "seo.video-provenance", route);
      check(legalVideo?.sameAs?.includes("https://www.instagram.com/avitolog_planb_prodvizenie/reel/Dd0vpW4PW5Q/"), "seo.video-instagram-provenance", route);
      check(legalVideo?.uploadDate === "2026-09-25" && legalVideo?.duration === "PT1M5S", "seo.video-metadata", route);
      check(count(html, "<video") === 8, "video.elements", route);
      check(count(html, "<track") === 8, "video.captions", route);
      check(count(html, 'preload="none"') === 8, "video.preload", route);
      check(count(html, "Открыть Reel") === 8, "video.instagram-links", route);
      check(count(html, "Редакционная пометка:") === 2, "video.editorial-notes", route);
      check(html.includes('id="podarok-klienta"') && html.includes('video-frame video-frame-wide'), "video.wide-modifier", route);
      for (const evidence of ["15–22 сентября 2026 года", "543 просмотра", "60 Контактов", "11%", "167 ₽", "501 активное объявление", "46 сохранений"]) {
        check(html.includes(evidence), "video.legal-evidence", evidence);
      }
      for (const unsupported of ["100 крупнейших городов", "обращения пришли из разных регионов", "отзывов практически нет"]) {
        check(!html.includes(unsupported), "video.legal-unsupported-claim", unsupported);
      }
      for (const asset of [
        "media/video/kejs-stroitelstvo-23-kontakta.mp4",
        "media/video/kejs-metalloprokat-126-kontaktov.mp4",
        "media/video/kejs-yuridicheskie-uslugi-60-kontaktov.mp4",
        "media/video/novye-prava-prodavtsov-avito-2026.mp4",
        "media/video/avito-i-nalogovaya-2026.mp4",
        "media/video/povedencheskie-faktory-avito.mp4",
        "media/video/pohozhie-obyavleniya-moderatsiya-arhiv.mp4",
        "media/video/podarok-klientu-planb.mp4",
        "media/posters/kejs-stroitelstvo-23-kontakta.jpg",
        "media/posters/kejs-metalloprokat-126-kontaktov.jpg",
        "media/posters/kejs-yuridicheskie-uslugi-60-kontaktov.jpg",
        "media/posters/novye-prava-prodavtsov-avito-2026.jpg",
        "media/posters/avito-i-nalogovaya-2026.jpg",
        "media/posters/povedencheskie-faktory-avito.jpg",
        "media/posters/pohozhie-obyavleniya-moderatsiya-arhiv.jpg",
        "media/posters/podarok-klientu-planb.jpg",
        "media/captions/kejs-stroitelstvo-23-kontakta.vtt",
        "media/captions/kejs-metalloprokat-126-kontaktov.vtt",
        "media/captions/kejs-yuridicheskie-uslugi-60-kontaktov.vtt",
        "media/captions/novye-prava-prodavtsov-avito-2026.vtt",
        "media/captions/avito-i-nalogovaya-2026.vtt",
        "media/captions/povedencheskie-faktory-avito.vtt",
        "media/captions/pohozhie-obyavleniya-moderatsiya-arhiv.vtt",
        "media/captions/podarok-klientu-planb.vtt"
      ]) {
        check(await exists(path.join(SITE_ROOT, asset)), "video.asset", asset);
      }
      for (const caption of [
        "media/captions/kejs-stroitelstvo-23-kontakta.vtt",
        "media/captions/kejs-metalloprokat-126-kontaktov.vtt",
        "media/captions/kejs-yuridicheskie-uslugi-60-kontaktov.vtt",
        "media/captions/novye-prava-prodavtsov-avito-2026.vtt",
        "media/captions/avito-i-nalogovaya-2026.vtt",
        "media/captions/povedencheskie-faktory-avito.vtt",
        "media/captions/pohozhie-obyavleniya-moderatsiya-arhiv.vtt",
        "media/captions/podarok-klientu-planb.vtt"
      ]) {
        const captionText = await fs.readFile(path.join(SITE_ROOT, caption), "utf8");
        const longLines = captionText.split(/\r?\n/).filter(line => line && line !== "WEBVTT" && !line.includes("-->") && [...line].length > 42);
        check(longLines.length === 0, "video.caption-line-length", `${caption}: ${longLines.join(" | ")}`);
        const toSeconds = stamp => {
          const parts = stamp.split(":").map(Number);
          return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
        };
        const denseCues = captionText.trim().split(/\r?\n\r?\n/).slice(1).flatMap(block => {
          const lines = block.split(/\r?\n/);
          const [start, end] = (lines.shift() || "").split(" --> ");
          if (!start || !end) return [`invalid cue: ${block}`];
          const duration = toSeconds(end) - toSeconds(start);
          const characters = [...lines.join(" ")].length;
          const cps = duration > 0 ? characters / duration : Infinity;
          return cps <= 22 ? [] : [`${start}-${end}: ${cps.toFixed(1)} cps`];
        });
        check(denseCues.length === 0, "video.caption-reading-speed", `${caption}: ${denseCues.join(" | ")}`);
      }
    }
    if (route === "/otzyvy/") {
      check(types.includes("CollectionPage") && types.includes("ItemList") && types.includes("BreadcrumbList"), "testimonials.schema", `${route}: ${types.join(", ")}`);
      check(!types.includes("Review") && !types.includes("AggregateRating"), "testimonials.no-invented-rating-schema", `${route}: ${types.join(", ")}`);
      const testimonialNodes = values.flatMap(value => value && Array.isArray(value["@graph"]) ? value["@graph"] : [value]);
      const testimonialList = testimonialNodes.find(node => node?.["@id"] === "https://planb-prodvizhenie.ru/otzyvy/#list");
      check(testimonialList?.numberOfItems === 4 && testimonialList?.itemListElement?.length === 4, "testimonials.list-count", route);
      check(count(html, "<video") === 4, "testimonials.video-count", route);
      check(count(html, "<track") === 4, "testimonials.caption-count", route);
      check(count(html, 'preload="none"') === 4, "testimonials.preload", route);
      check(count(html, "Видео клиента") === 4, "testimonials.client-labels", route);
      check(html.includes("Телефон и государственный номер автомобиля в кадре скрыты"), "testimonials.pii-note", route);
      for (const asset of [
        "media/testimonials/otzyv-sergey-gruzoperevozki-01.mp4",
        "media/testimonials/otzyv-o-prodvizhenii-na-avito-02.mp4",
        "media/testimonials/otzyv-o-prodvizhenii-na-avito-03.mp4",
        "media/testimonials/otzyv-arenda-nedvizhimosti-04.mp4",
        "media/testimonials/otzyv-sergey-gruzoperevozki-01.jpg",
        "media/testimonials/otzyv-o-prodvizhenii-na-avito-02.jpg",
        "media/testimonials/otzyv-o-prodvizhenii-na-avito-03.jpg",
        "media/testimonials/otzyv-arenda-nedvizhimosti-04.jpg",
        "media/captions/otzyv-sergey-gruzoperevozki-01.vtt",
        "media/captions/otzyv-o-prodvizhenii-na-avito-02.vtt",
        "media/captions/otzyv-o-prodvizhenii-na-avito-03.vtt",
        "media/captions/otzyv-arenda-nedvizhimosti-04.vtt"
      ]) {
        check(await exists(path.join(SITE_ROOT, asset)), "testimonials.asset", asset);
      }
    }

    if (marketing) {
      check(count(html, "/assets/analytics-consent.js") === 1, "asset.consent-loader", route);
      check(count(html, "/assets/scrollcraft.css") === 1, "asset.scrollcraft-css", route);
      check(count(html, "/assets/scrollcraft.js") === 1, "asset.scrollcraft-js", route);
      check(!html.includes("mc.yandex.ru/metrika"), "analytics.direct-metrika", route);
      if (route === "/") {
        check(count(html, "/assets/home-depth.css") === 1, "asset.home-css", route);
        check(count(html, "/assets/home-depth.js") === 1, "asset.home-js", route);
        check(count(html, "/assets/site-depth.css") === 0, "asset.home-site-css-duplicate", route);
        check(count(html, "/assets/site-depth.js") === 0, "asset.home-site-js-duplicate", route);
      } else {
        check(count(html, "/assets/site-depth.css") === 1, "asset.site-css", route);
        check(count(html, "/assets/site-depth.js") === 1, "asset.site-js", route);
      }
    } else {
      check(count(html, "/assets/legal-depth.css") === 1, "asset.legal-css", route);
      check(count(html, "/assets/analytics-consent.js") === 0, "asset.legal-consent-loader", route);
      check(count(html, "/assets/scrollcraft.js") === 0, "asset.legal-scrollcraft", route);
    }

    for (const anchor of extractAnchors(html)) {
      if (anchor.target.toLowerCase() === "_blank") {
        const rel = new Set(anchor.rel.toLowerCase().split(/\s+/).filter(Boolean));
        if (!rel.has("noopener") || !rel.has("noreferrer")) {
          localLinkFailures.push(`${route}: target=_blank without noopener noreferrer: ${anchor.href}`);
        }
      }
      if (/^(mailto:|tel:|sms:|javascript:)/i.test(anchor.href)) continue;
      let target;
      try {
        target = new URL(anchor.href, new URL(route, "https://planb-prodvizhenie.ru"));
      } catch {
        localLinkFailures.push(`${route}: malformed href ${anchor.href}`);
        continue;
      }
      if (target.origin !== "https://planb-prodvizhenie.ru") continue;
      const targetFile = await resolveRequestPath(SITE_ROOT, target.pathname);
      if (!targetFile) {
        localLinkFailures.push(`${route}: missing local target ${target.pathname}`);
        continue;
      }
      if (target.hash) {
        const targetHtml = await fs.readFile(targetFile, "utf8");
        if (!hasId(targetHtml, target.hash)) localLinkFailures.push(`${route}: missing fragment ${target.pathname}${target.hash}`);
      }
    }

    active.push({ route, file: relative, marketing, title: tagContent(html, "title"), canonical: canonicalHref(html) });
  }
  check(localLinkFailures.length === 0, "links.static", localLinkFailures.slice(0, 12).join(" | "));

  const sitemap = await fs.readFile(path.join(SITE_ROOT, "sitemap.xml"), "utf8");
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const expectedSitemap = [
    ...MARKETING_ROUTES.map(expectedCanonical),
    "https://planb-prodvizhenie.ru/sokrat",
    "https://planb-prodvizhenie.ru/rekvizity.html",
    "https://planb-prodvizhenie.ru/oferta.html"
  ];
  check(sitemapUrls.length === expectedSitemap.length, "sitemap.count", `expected ${expectedSitemap.length}, got ${sitemapUrls.length}`);
  check(new Set(sitemapUrls).size === sitemapUrls.length, "sitemap.duplicates");
  check(expectedSitemap.every(url => sitemapUrls.includes(url)), "sitemap.missing", expectedSitemap.filter(url => !sitemapUrls.includes(url)).join(", "));
  check(sitemapUrls.every(url => expectedSitemap.includes(url)), "sitemap.unexpected", sitemapUrls.filter(url => !expectedSitemap.includes(url)).join(", "));
  const sitemapLastmods = new Map([...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map(match => [match[1], match[2]]));
  for (const route of ["/", "/video/"]) {
    const url = expectedCanonical(route);
    check(sitemapLastmods.get(url) === "2026-09-28", "sitemap.lastmod", `${url}: ${sitemapLastmods.get(url) || "missing"}`);
  }
  for (const route of ["/kejsy/", ...CASE_DETAIL_ROUTES]) {
    const url = expectedCanonical(route);
    check(sitemapLastmods.get(url) === "2026-09-29", "sitemap.case-lastmod", `${url}: ${sitemapLastmods.get(url) || "missing"}`);
  }

  report.static = { active, immutable, currentLegalEvidence, localLinkFailures, sitemapUrls, sitemapLastmods: Object.fromEntries(sitemapLastmods) };
}

async function installPageRouting(page, baseURL, externalRequests, leadHandler = null) {
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === baseURL) {
      await route.continue();
      return;
    }
    externalRequests.push({ url: request.url(), method: request.method(), type: request.resourceType() });
    if (url.hostname === LEAD_HOST && url.pathname === LEAD_PATH && leadHandler) {
      await leadHandler(route, request);
      return;
    }
    await route.fulfill(fulfilledExternal(request));
  });
}

async function scrollSweep(page, reduced) {
  await page.evaluate(async prefersReduced => {
    const targets = [...document.querySelectorAll(".reveal,[data-sc-in],img[loading='lazy']")];
    const positions = [...new Set(targets.map(element => Math.max(0, Math.round(element.getBoundingClientRect().top + scrollY - innerHeight * 0.62))))].sort((a, b) => a - b);
    for (const top of positions) {
      window.scrollTo({ top, behavior: "instant" });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!prefersReduced) await new Promise(resolve => setTimeout(resolve, 18));
    }
  }, reduced);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(reduced ? 30 : 120);
}

async function inspectRuntime(page, noJs = false) {
  return page.evaluate(javaScriptDisabled => {
    const parseSeconds = value => String(value).split(",").some(part => Number.parseFloat(part) > 0.01);
    const duplicateIds = [...document.querySelectorAll("[id]")]
      .map(element => element.id)
      .filter((id, index, all) => id && all.indexOf(id) !== index);
    const missingAnchors = [...document.querySelectorAll("a[href^='#']")]
      .map(link => link.getAttribute("href"))
      .filter(href => href && href !== "#" && !document.getElementById(decodeURIComponent(href.slice(1))));
    const unlabeledFields = [...document.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button']),textarea,select")]
      .filter(field => {
        if (field.type === "checkbox" && field.closest("label")) return false;
        if (field.closest("label")) return false;
        if (field.id && document.querySelector(`label[for="${CSS.escape(field.id)}"]`)) return false;
        return !(field.getAttribute("aria-label") || field.getAttribute("aria-labelledby") || field.title);
      })
      .map(field => field.id || field.name || field.outerHTML.slice(0, 80));
    const unnamedControls = [...document.querySelectorAll("button,a[href]")]
      .filter(element => {
        const text = (element.innerText || element.textContent || "").trim();
        const imgAlt = element.querySelector("img[alt]")?.getAttribute("alt") || "";
        return !(text || imgAlt || element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || element.title);
      })
      .map(element => element.id || element.className || element.outerHTML.slice(0, 80));
    const unnamedMedia = [...document.querySelectorAll("video,audio")]
      .filter(element => !(element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || element.title))
      .map(element => element.outerHTML.slice(0, 120));
    const badBlankTargets = [...document.querySelectorAll("a[target='_blank']")]
      .filter(link => {
        const rel = new Set((link.getAttribute("rel") || "").toLowerCase().split(/\s+/));
        return !rel.has("noopener") || !rel.has("noreferrer");
      })
      .map(link => link.href);
    const jsonLd = [...document.querySelectorAll("script[type='application/ld+json']")].map(script => {
      try {
        JSON.parse(script.textContent);
        return null;
      } catch (error) {
        return String(error);
      }
    }).filter(Boolean);
    const hiddenReveals = [...document.querySelectorAll(".reveal,[data-sc-in]")]
      // Responsive components intentionally absent from this layout do not
      // enter the viewport or receive reveal classes; visible content must.
      .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).display !== "none")
      .filter(element => javaScriptDisabled
        ? Number.parseFloat(getComputedStyle(element).opacity) < 0.95 || getComputedStyle(element).visibility === "hidden"
        : (element.hasAttribute("data-sc-in")
          ? !element.classList.contains("sc-in")
          : !element.classList.contains("in") && !element.classList.contains("sc-in")))
      .map(element => (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80));
    const movingForever = [...document.querySelectorAll("*")]
      .filter(element => {
        const style = getComputedStyle(element);
        return style.animationName !== "none" && style.animationIterationCount.split(",").some(value => value.trim() === "infinite") && parseSeconds(style.animationDuration);
      })
      .map(element => `${element.tagName.toLowerCase()}.${String(element.className || "").replace(/\s+/g, ".").slice(0, 70)}`);
    const localStyles = [...document.querySelectorAll("link[rel='stylesheet']")].map(link => new URL(link.href).pathname);
    const localScripts = [...document.scripts].filter(script => script.src).map(script => new URL(script.src).pathname);
    const contactRect = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        href: element.getAttribute("href") || "",
        label: element.getAttribute("aria-label") || (element.textContent || "").trim(),
        width: rect.width,
        height: rect.height,
        display: style.display,
        visibility: style.visibility,
        opacity: Number.parseFloat(style.opacity),
        insideViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
        hit: hit === element || element.contains(hit)
      };
    };
    const contactDock = document.querySelector(".contact-dock.planb-contact-dock");
    return {
      url: location.pathname,
      title: document.title,
      description: document.querySelector("meta[name='description']")?.content || "",
      canonical: document.querySelector("link[rel='canonical']")?.href || "",
      lang: document.documentElement.lang,
      viewport: document.querySelector("meta[name='viewport']")?.content || "",
      h1: document.querySelectorAll("h1").length,
      main: document.querySelectorAll("main").length,
      nav: document.querySelectorAll("nav").length,
      footer: document.querySelectorAll("footer").length,
      jsonLdCount: document.querySelectorAll("script[type='application/ld+json']").length,
      jsonLdErrors: jsonLd,
      bodyScrollWidth: document.body.scrollWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      pageHeight: document.documentElement.scrollHeight,
      duplicateIds: [...new Set(duplicateIds)],
      missingAnchors,
      unlabeledFields,
      unnamedControls,
      unnamedMedia,
      badBlankTargets,
      brokenImages: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src),
      hiddenReveals,
      movingForever,
      reducedMedia: matchMedia("(prefers-reduced-motion: reduce)").matches,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      engineInstances: window.ScrollCraft?.instances?.length || 0,
      engineReduced: Boolean(window.ScrollCraft?.reduce),
      consentLoaders: localScripts.filter(value => value === "/assets/analytics-consent.js").length,
      scrollcraftScripts: localScripts.filter(value => value === "/assets/scrollcraft.js").length,
      homeScripts: localScripts.filter(value => value === "/assets/home-depth.js").length,
      siteScripts: localScripts.filter(value => value === "/assets/site-depth.js").length,
      contactScripts: localScripts.filter(value => value === "/assets/contact-layer.js").length,
      scrollcraftStyles: localStyles.filter(value => value === "/assets/scrollcraft.css").length,
      homeStyles: localStyles.filter(value => value === "/assets/home-depth.css").length,
      siteStyles: localStyles.filter(value => value === "/assets/site-depth.css").length,
      contactStyles: localStyles.filter(value => value === "/assets/contact-layer.css").length,
      legalStyles: localStyles.filter(value => value === "/assets/legal-depth.css").length,
      primaryNavLabels: [...document.querySelectorAll("header #mainNav a:not(.nav-cta), .nav .nav-links a:not(.nav-cta)")]
        .map(link => (link.textContent || "").trim())
        .filter(Boolean),
      topContacts: [...document.querySelectorAll(".contact-strip-links a")].map(contactRect),
      pageHeaderContacts: [...document.querySelectorAll(".planb-header-contact-links a")].map(contactRect),
      contactDock: contactDock ? {
        display: getComputedStyle(contactDock).display,
        visibility: getComputedStyle(contactDock).visibility,
        opacity: Number.parseFloat(getComputedStyle(contactDock).opacity),
        links: [...contactDock.querySelectorAll("a[href]")].map(contactRect)
      } : null,
      textLength: document.body.innerText.length,
      formCount: document.querySelectorAll("form").length
    };
  }, noJs);
}

async function keyboardAudit(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const items = [];
  for (let index = 0; index < 18; index += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(90);
    items.push(await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return { target: "body", visible: true, focusVisible: false };
      const style = getComputedStyle(active);
      const rect = active.getBoundingClientRect();
      return {
        target: active.id || active.getAttribute("aria-label") || (active.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60) || active.tagName,
        visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0,
        focusVisible: style.outlineStyle !== "none" || style.boxShadow !== "none"
      };
    }));
  }
  return items;
}

async function renderRoute({ browser, baseURL, route, profile, screenshot = false, keyboard = false }) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.width <= 420 ? 2 : 1,
    reducedMotion: profile.reduced ? "reduce" : "no-preference",
    javaScriptEnabled: profile.javaScript !== false
  });
  if (profile.javaScript !== false) await seedDeniedConsent(context);
  const page = await context.newPage();
  const consoleErrors = [];
  const requestFailures = [];
  const badResponses = [];
  const externalRequests = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => consoleErrors.push(String(error)));
  page.on("requestfailed", request => {
    if (request.url().startsWith(baseURL)) requestFailures.push(`${request.failure()?.errorText || "failed"} ${request.url()}`);
  });
  page.on("response", response => {
    if (response.url().startsWith(baseURL) && response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });
  await installPageRouting(page, baseURL, externalRequests);

  const response = await page.goto(baseURL + route, { waitUntil: "load", timeout: 15000 });
  check(response?.status() === 200, "runtime.http", `${profile.name} ${route}: ${response?.status()}`);
  await page.evaluate(() => document.fonts?.ready || Promise.resolve());
  await page.waitForTimeout(profile.javaScript === false ? 30 : 180);
  if (profile.javaScript !== false && MARKETING_ROUTES.includes(route)) await scrollSweep(page, profile.reduced);
  const state = await inspectRuntime(page, profile.javaScript === false);

  check(state.bodyScrollWidth <= profile.width + 1 && state.rootScrollWidth <= profile.width + 1, "runtime.overflow", `${profile.name} ${route}: body=${state.bodyScrollWidth}, root=${state.rootScrollWidth}, viewport=${profile.width}`);
  check(state.lang === "ru", "runtime.lang", `${profile.name} ${route}: ${state.lang}`);
  check(state.viewport.length > 0, "runtime.viewport-meta", `${profile.name} ${route}`);
  check(state.title.length > 0 && state.description.length > 0, "runtime.metadata", `${profile.name} ${route}`);
  check(state.canonical === expectedCanonical(route), "runtime.canonical", `${profile.name} ${route}: ${state.canonical}`);
  check(state.h1 === 1, "runtime.h1", `${profile.name} ${route}: ${state.h1}`);
  check(state.duplicateIds.length === 0, "runtime.duplicate-ids", `${profile.name} ${route}: ${state.duplicateIds.join(", ")}`);
  check(state.missingAnchors.length === 0, "runtime.missing-anchor", `${profile.name} ${route}: ${state.missingAnchors.join(", ")}`);
  check(state.unlabeledFields.length === 0, "a11y.unlabeled-fields", `${profile.name} ${route}: ${state.unlabeledFields.join(" | ")}`);
  check(state.unnamedControls.length === 0, "a11y.unnamed-controls", `${profile.name} ${route}: ${state.unnamedControls.join(" | ")}`);
  check(state.unnamedMedia.length === 0, "a11y.unnamed-media", `${profile.name} ${route}: ${state.unnamedMedia.join(" | ")}`);
  check(state.badBlankTargets.length === 0, "a11y.blank-rel", `${profile.name} ${route}: ${state.badBlankTargets.join(", ")}`);
  check(state.brokenImages.length === 0, "runtime.broken-images", `${profile.name} ${route}: ${state.brokenImages.join(", ")}`);
  check(state.jsonLdErrors.length === 0, "runtime.jsonld", `${profile.name} ${route}: ${state.jsonLdErrors.join(" | ")}`);
  check(consoleErrors.length === 0, "runtime.console", `${profile.name} ${route}: ${consoleErrors.join(" | ")}`);
  check(requestFailures.length === 0, "runtime.request", `${profile.name} ${route}: ${requestFailures.join(" | ")}`);
  check(badResponses.length === 0, "runtime.response", `${profile.name} ${route}: ${badResponses.join(" | ")}`);

  const analyticsRequests = externalRequests.filter(item => /(^|\.)mc\.yandex\.ru$/i.test(new URL(item.url).hostname));
  if (profile.javaScript !== false) check(analyticsRequests.length === 0, "analytics.before-consent", `${profile.name} ${route}: ${analyticsRequests.map(item => item.url).join(", ")}`);

  if (MARKETING_ROUTES.includes(route)) {
    check(state.main === 1, "runtime.main", `${profile.name} ${route}: ${state.main}`);
    check(state.nav >= 1 && state.footer === 1, "runtime.landmarks", `${profile.name} ${route}: nav=${state.nav}, footer=${state.footer}`);
    check(state.jsonLdCount >= 1, "runtime.jsonld-count", `${profile.name} ${route}`);
    if (profile.javaScript !== false) {
      check(state.consentLoaders === 1, "runtime.consent-loader", `${profile.name} ${route}: ${state.consentLoaders}`);
      check(state.scrollcraftScripts === 1 && state.scrollcraftStyles === 1, "runtime.scrollcraft-assets", `${profile.name} ${route}: js=${state.scrollcraftScripts}, css=${state.scrollcraftStyles}`);
      check(state.engineInstances === 1, "runtime.scrollcraft-instance", `${profile.name} ${route}: ${state.engineInstances}`);
      check(state.hiddenReveals.length === 0, "motion.hidden-reveal", `${profile.name} ${route}: ${state.hiddenReveals.slice(0, 5).join(" | ")}`);
      check(state.contactScripts === 1 && state.contactStyles === 1, "runtime.contact-assets", `${profile.name} ${route}: js=${state.contactScripts}, css=${state.contactStyles}`);
      for (const label of ["Услуги", "Кейсы", "Блог", "Видео", "Отзывы", "Контакты"]) {
        check(state.primaryNavLabels.includes(label), "navigation.core-link", `${profile.name} ${route}: missing ${label}; got ${state.primaryNavLabels.join(" | ")}`);
      }
      check(Boolean(state.contactDock) && state.contactDock.links.length === 3, "contact.dock-count", `${profile.name} ${route}: ${JSON.stringify(state.contactDock)}`);
      const dockTargets = state.contactDock?.links.map(item => item.href) || [];
      check(dockTargets[0]?.startsWith("tel:") && dockTargets[1]?.includes("wa.me/") && dockTargets[2]?.includes("t.me/"), "contact.dock-order", `${profile.name} ${route}: ${dockTargets.join(", ")}`);
      const headerContacts = route === "/" ? state.topContacts : state.pageHeaderContacts;
      check(headerContacts.length === 3, "contact.header-count", `${profile.name} ${route}: ${headerContacts.length}`);
      const contactSchemes = headerContacts.map(item => item.href).sort();
      check(contactSchemes.some(href => href.startsWith("tel:")) && contactSchemes.some(href => href.includes("wa.me/")) && contactSchemes.some(href => href.includes("t.me/")), "contact.header-targets", `${profile.name} ${route}: ${contactSchemes.join(", ")}`);
      check(headerContacts.every(item => item.width > 0 && item.height > 0 && item.visibility === "visible" && item.insideViewport && item.hit), "contact.header-visible", `${profile.name} ${route}: ${JSON.stringify(headerContacts)}`);
      check(state.contactDock.display !== "none" && state.contactDock.visibility === "visible" && state.contactDock.opacity >= 0.99, "contact.dock-visible-at-top", `${profile.name} ${route}: ${JSON.stringify(state.contactDock)}`);
      check(state.contactDock.links.every(item => item.width >= 44 && item.height >= 44 && item.insideViewport && item.hit), "contact.dock-tap-targets-at-top", `${profile.name} ${route}: ${JSON.stringify(state.contactDock)}`);
      if (route === "/") check(state.homeScripts === 1 && state.homeStyles === 1 && state.siteScripts === 0 && state.siteStyles === 0, "runtime.home-assets", `${profile.name} ${route}`);
      else check(state.siteScripts === 1 && state.siteStyles === 1, "runtime.site-assets", `${profile.name} ${route}: js=${state.siteScripts}, css=${state.siteStyles}`);
    } else {
      check(state.hiddenReveals.length === 0, "nojs.hidden-reveal", `${profile.name} ${route}: ${state.hiddenReveals.slice(0, 5).join(" | ")}`);
      const noJs = await page.evaluate(() => ({
        visibleNavLinks: [...document.querySelectorAll("nav a")].filter(link => {
          const style = getComputedStyle(link);
          const rect = link.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
        }).length,
        visibleActions: [...document.querySelectorAll("a.btn,a.nav-cta,a.top-cta,a[href*='#contact'],a[href*='#audit']")].filter(link => {
          const style = getComputedStyle(link);
          const rect = link.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
        }).length,
        formVisible: [...document.forms].every(form => getComputedStyle(form).display !== "none")
      }));
      check(noJs.visibleNavLinks > 0, "nojs.navigation", `${profile.name} ${route}`);
      check(noJs.visibleActions > 0, "nojs.actions", `${profile.name} ${route}`);
      check(noJs.formVisible, "nojs.forms", `${profile.name} ${route}`);
      state.noJs = noJs;
    }
  } else {
    if (profile.javaScript !== false) check(state.legalStyles === 1, "runtime.legal-style", `${profile.name} ${route}: ${state.legalStyles}`);
  }

  if (profile.reduced && MARKETING_ROUTES.includes(route)) {
    check(state.reducedMedia, "motion.reduced-media", `${profile.name} ${route}`);
    check(state.engineReduced, "motion.engine-reduced", `${profile.name} ${route}`);
    check(state.movingForever.length === 0, "motion.infinite-under-reduce", `${profile.name} ${route}: ${state.movingForever.slice(0, 8).join(" | ")}`);
    check(state.scrollBehavior !== "smooth", "motion.smooth-under-reduce", `${profile.name} ${route}: ${state.scrollBehavior}`);
  }

  if (profile.javaScript !== false && MARKETING_ROUTES.includes(route) && profile.width <= 1360) {
    await page.evaluate(() => {
      window.scrollTo({ top: Math.min(Math.max(80, innerHeight * 0.45), Math.max(0, document.documentElement.scrollHeight - innerHeight)), behavior: "instant" });
    });
    await page.waitForFunction(
      () => document.documentElement.matches(".home-scrolled,.site-scrolled"),
      undefined,
      { timeout: 2000 }
    );
    if (!profile.reduced) await page.waitForTimeout(240);
    const expectsBottomDock = route === "/prodvizhenie-instagram" && profile.width <= 720;
    const settledDockState = await page.evaluate(async expectsBottomDock => {
      const dock = document.querySelector(".contact-dock.planb-contact-dock");
      if (!dock) return null;
      const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const dockRect = dock.getBoundingClientRect();
      const links = [...dock.querySelectorAll("a[href]")].map(link => {
        const rect = link.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          width: rect.width,
          height: rect.height,
          insideViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
          hit: hit === link || link.contains(hit)
        };
      });
      const style = getComputedStyle(dock);
      const contentOverlaps = [];
      const bottomDockSamples = [];
      const mainActionChecks = [];
      const contentSelector = "main p,main li,main h1,main h2,main h3,main a[href],main button,main input,main textarea,main video,main .case-feature-card,main .stage-card,main .kpi,main form";
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const samplePositions = [...new Set([scrollY, maxScroll * 0.25, maxScroll * 0.5, maxScroll * 0.75, maxScroll].map(Math.round))];
      for (const top of samplePositions) {
        window.scrollTo({ top, behavior: "instant" });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const currentDockRect = dock.getBoundingClientRect();
        if (expectsBottomDock) {
          const currentStyle = getComputedStyle(dock);
          const bottom = Number.parseFloat(currentStyle.bottom);
          const currentLinks = [...dock.querySelectorAll("a[href]")].map(link => {
            const rect = link.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return { width: rect.width, height: rect.height, centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2,
              insideViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
              hit: hit === link || link.contains(hit) };
          });
          bottomDockSamples.push({ scrollY, position: currentStyle.position, direction: currentStyle.flexDirection,
            top: currentDockRect.top, bottom: currentDockRect.bottom, gap: innerHeight - currentDockRect.bottom, cssBottom: bottom,
            anchored: currentStyle.position === "fixed" && currentStyle.flexDirection === "row" && Number.isFinite(bottom)
              && currentDockRect.top >= innerHeight * 0.7 && bottom >= 0 && Math.abs(innerHeight - currentDockRect.bottom - bottom) <= 2,
            horizontal: currentLinks.length === 3 && currentLinks.every((link, index) => index === 0
              || (link.centerX > currentLinks[index - 1].centerX && Math.abs(link.centerY - currentLinks[0].centerY) <= 2)),
            links: currentLinks });
          continue;
        }
        [...document.querySelectorAll(contentSelector)].forEach(element => {
          const rect = element.getBoundingClientRect();
          const elementStyle = getComputedStyle(element);
          if (elementStyle.display !== "none" && elementStyle.visibility !== "hidden" && Number(elementStyle.opacity) > 0 && rect.width > 0 && rect.height > 0 && intersects(rect, currentDockRect)) {
            contentOverlaps.push(`${top}:${element.tagName.toLowerCase()}.${String(element.className || "").replace(/\s+/g, ".").slice(0, 72)}`);
          }
        });
      }
      if (expectsBottomDock) {
        // A bottom bar deliberately covers text while it scrolls past. Instead
        // of the sidebar's reserved-column rule, every visible main action must
        // be fully reachable between the sticky header and the bottom bar.
        const actionSelector = "main a[href],main button,main input:not([type='hidden']),main select,main textarea,main summary,main [role='button'],main [tabindex]";
        const isVisible = element => {
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0 || element.getClientRects().length === 0) return false;
          for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor);
            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0) return false;
          }
          const closedDetails = element.closest("details:not([open])");
          const summary = closedDetails?.querySelector(":scope > summary");
          return !closedDetails || summary === element || Boolean(summary?.contains(element));
        };
        const actions = [...document.querySelectorAll(actionSelector)].filter(isVisible);
        for (const element of actions) {
          element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const rect = element.getBoundingClientRect();
          const currentDockRect = dock.getBoundingClientRect();
          const headerBottom = [...document.querySelectorAll(".contact-strip,.planb-header-contact-strip,.nav,header")]
            .reduce((bottom, header) => {
              const style = getComputedStyle(header), bounds = header.getBoundingClientRect();
              return (style.position === "fixed" || style.position === "sticky") && style.display !== "none"
                && style.visibility !== "hidden" && Number(style.opacity) > 0 && bounds.top < innerHeight * 0.35 && bounds.bottom > 0
                ? Math.max(bottom, bounds.bottom) : bottom;
            }, 0);
          const hitPoints = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([x, y]) => {
            const target = document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y);
            return target === element || element.contains(target);
          });
          mainActionChecks.push({
            target: element.id || element.getAttribute("aria-label") || (element.textContent || element.getAttribute("name") || element.tagName).trim().replace(/\s+/g, " ").slice(0, 90),
            href: element.getAttribute("href") || "", scrollY, headerBottom, dockTop: currentDockRect.top,
            rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
            visible: isVisible(element),
            unobscured: rect.left >= 0 && rect.right <= innerWidth && rect.top >= headerBottom - 1
              && rect.bottom <= currentDockRect.top - 1 && rect.bottom <= innerHeight,
            hit: hitPoints.every(Boolean), hitPoints
          });
        }
        window.scrollTo({ top: maxScroll, behavior: "instant" });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      const settings = document.querySelector("#planb-analytics-settings");
      const settingsRect = settings?.getBoundingClientRect();
      const headerContactSelector = location.pathname === "/" ? ".contact-strip-links a" : ".planb-header-contact-links a";
      const headerContacts = [...document.querySelectorAll(headerContactSelector)].map(link => {
        const rect = link.getBoundingClientRect();
        const linkStyle = getComputedStyle(link);
        return {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          bottom: rect.bottom,
          visible: linkStyle.display !== "none" && linkStyle.visibility !== "hidden" && Number(linkStyle.opacity) > 0 && rect.top >= 0 && rect.bottom <= innerHeight,
          hit: (() => {
            const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return target === link || link.contains(target);
          })()
        };
      });
      return {
        display: style.display,
        visibility: style.visibility,
        opacity: Number.parseFloat(style.opacity),
        links,
        headerContacts,
        contentOverlaps,
        bottomDockSamples,
        mainActionChecks,
        settings: settingsRect ? {
          width: settingsRect.width,
          height: settingsRect.height,
          insideViewport: settingsRect.left >= 0 && settingsRect.right <= innerWidth && settingsRect.top >= 0 && settingsRect.bottom <= innerHeight,
          overlapsDock: intersects(settingsRect, dockRect)
        } : null
      };
    }, expectsBottomDock);
    check(Boolean(settledDockState), "contact.dock-runtime", `${profile.name} ${route}`);
    check(settledDockState?.display !== "none" && settledDockState?.visibility === "visible" && settledDockState?.opacity >= 0.99, "contact.dock-visible-after-scroll", `${profile.name} ${route}: ${JSON.stringify(settledDockState)}`);
    check(settledDockState?.links.length === 3 && settledDockState.links.every(item => item.width >= 44 && item.height >= 44 && item.insideViewport && item.hit), "contact.dock-tap-targets", `${profile.name} ${route}: ${JSON.stringify(settledDockState)}`);
    check(settledDockState?.headerContacts.length === 3 && settledDockState.headerContacts.every(item => item.visible && item.hit), "contact.header-visible-after-scroll", `${profile.name} ${route}: ${JSON.stringify(settledDockState?.headerContacts)}`);
    if (expectsBottomDock) {
      check(settledDockState?.bottomDockSamples.length > 0 && settledDockState.bottomDockSamples.every(sample => sample.anchored && sample.horizontal), "contact.bottom-dock-anchor", `${profile.name} ${route}: ${JSON.stringify(settledDockState?.bottomDockSamples)}`);
      check(settledDockState?.bottomDockSamples.every(sample => sample.links.length === 3 && sample.links.every(link => link.width >= 44 && link.height >= 44 && link.insideViewport && link.hit)), "contact.bottom-dock-tap-targets", `${profile.name} ${route}: ${JSON.stringify(settledDockState?.bottomDockSamples)}`);
      check(settledDockState?.mainActionChecks.length > 0 && settledDockState.mainActionChecks.every(action => action.visible && action.unobscured && action.hit), "contact.bottom-dock-action-reachability", `${profile.name} ${route}: ${JSON.stringify(settledDockState?.mainActionChecks.filter(action => !action.visible || !action.unobscured || !action.hit))}`);
      state.bottomDockAudit = { samples: settledDockState?.bottomDockSamples, actions: settledDockState?.mainActionChecks };
    } else {
      check(settledDockState?.contentOverlaps.length === 0, "contact.dock-content-overlap", `${profile.name} ${route}: ${settledDockState?.contentOverlaps.join(", ")}`);
    }
    check(Boolean(settledDockState?.settings) && settledDockState.settings.width >= 44 && settledDockState.settings.height >= 44 && settledDockState.settings.insideViewport && !settledDockState.settings.overlapsDock, "contact.settings-position", `${profile.name} ${route}: ${JSON.stringify(settledDockState?.settings)}`);
  }

  let focusOrder = [];
  if (keyboard && profile.javaScript !== false) {
    focusOrder = await keyboardAudit(page);
    check(focusOrder.every(item => item.visible), "a11y.hidden-focus", `${profile.name} ${route}: ${focusOrder.filter(item => !item.visible).map(item => item.target).join(", ")}`);
    check(focusOrder.some(item => item.focusVisible), "a11y.focus-indicator", `${profile.name} ${route}`);
  }

  if (screenshot) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: path.join(SCREENSHOTS, `${profile.name}-${screenshotName(route)}.png`) });
  }
  await context.close();
  return { route, profile, state, focusOrder, consoleErrors, requestFailures, badResponses, externalRequests };
}

async function runRenderProfiles(browser, baseURL) {
  const fullProfiles = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 }
  ];
  for (const profile of fullProfiles) {
    for (const route of ACTIVE_ROUTES) {
      const result = await renderRoute({
        browser,
        baseURL,
        route,
        profile,
        screenshot: REPRESENTATIVE_ROUTES.includes(route),
        keyboard: profile.name === "desktop" && REPRESENTATIVE_ROUTES.includes(route)
      });
      report.profiles.push(result);
    }
  }

  const extendedProfiles = [
    { name: "laptop", width: 1280, height: 720 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "compact", width: 360, height: 640 },
    { name: "minimum", width: 320, height: 568 }
  ];
  for (const profile of extendedProfiles) {
    for (const route of REPRESENTATIVE_ROUTES) {
      report.profiles.push(await renderRoute({ browser, baseURL, route, profile }));
    }
  }

  const reduced = { name: "reduced-mobile", width: 390, height: 844, reduced: true };
  const noJs = { name: "no-js-mobile", width: 390, height: 844, javaScript: false };
  for (const route of REPRESENTATIVE_ROUTES) {
    report.profiles.push(await renderRoute({ browser, baseURL, route, profile: reduced }));
    report.profiles.push(await renderRoute({ browser, baseURL, route, profile: noJs }));
  }
}

async function runContactStability(browser, baseURL) {
  for (const contract of [
    { route: "/", delayedAsset: "/assets/home-depth.js", mainGutter: "60px" },
    { route: "/video/", delayedAsset: "/assets/site-depth.js", mainGutter: "80px" }
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await seedDeniedConsent(context);
    await context.addInitScript(() => {
      window.__qaLayoutShifts = [];
      new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          if (!entry.hadRecentInput) window.__qaLayoutShifts.push(entry.value);
        });
      }).observe({ type: "layout-shift", buffered: true });
    });
    const page = await context.newPage();
    await page.route(`**${contract.delayedAsset}`, async intercepted => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      await intercepted.continue();
    });
    await page.goto(baseURL + contract.route, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => {
      const strip = document.querySelector(".contact-strip,.planb-header-contact-strip")?.getBoundingClientRect();
      const mainShell = document.querySelector("main .container,main.wrap,main .wrap");
      const mainStyle = mainShell && getComputedStyle(mainShell);
      return {
        shifts: window.__qaLayoutShifts || [],
        cls: (window.__qaLayoutShifts || []).reduce((total, value) => total + value, 0),
        strip: strip ? { top: strip.top, height: strip.height } : null,
        mainPaddingRight: mainStyle?.paddingRight || ""
      };
    });
    check(state.cls === 0, "contact.slow-load-cls", `${contract.route}: ${JSON.stringify(state)}`);
    check(state.strip?.top === 0 && state.strip?.height >= 33 && state.strip?.height <= 34.5, "contact.slow-load-strip", `${contract.route}: ${JSON.stringify(state.strip)}`);
    const isConversionCandidate = await page.locator("body.cro-home").count() > 0;
    const expectedGutter = isConversionCandidate ? contract.mainGutter : "80px";
    check(state.mainPaddingRight === expectedGutter, "contact.slow-load-gutter", `${contract.route}: expected ${expectedGutter}, got ${state.mainPaddingRight}`);
    report.contactStability.push({ ...contract, ...state });
    await context.close();
  }
}

async function formAttempt(browser, baseURL, contract, outcome) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await seedDeniedConsent(context);
  await context.addInitScript(() => {
    window.__qaGoals = [];
    window.ym = (...args) => window.__qaGoals.push(args);
  });
  const page = await context.newPage();
  const externalRequests = [];
  let payload = null;
  let resolveSent;
  const sent = new Promise(resolve => { resolveSent = resolve; });
  await installPageRouting(page, baseURL, externalRequests, async (route, request) => {
    try {
      payload = request.postDataJSON();
    } catch {
      payload = null;
    }
    resolveSent(payload);
    await new Promise(resolve => setTimeout(resolve, 120));
    await route.fulfill({
      status: outcome === "success" ? 200 : 500,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(outcome === "success" ? { ok: true } : { ok: false })
    });
  });
  const query = "?utm_source=qa&utm_medium=automation&utm_campaign=sitewide&utm_content=form&utm_term=avito&yclid=qa-yclid";
  await page.goto(baseURL + contract.route + query, { waitUntil: "load" });
  await page.waitForTimeout(160);
  const form = page.locator(contract.selector);
  const message = page.locator(contract.status);

  if (outcome === "success") {
    await form.evaluate(element => element.requestSubmit());
    await page.waitForTimeout(30);
    check((await message.textContent() || "").trim().length > 0, "form.phone-validation", contract.route);
    check(await page.locator(contract.phone).evaluate(element => element === document.activeElement || element.getAttribute("aria-invalid") === "true" || element.classList.contains("err")), "form.phone-focus", contract.route);

    await page.locator(contract.phone).fill("+7 999 123-45-67");
    await form.evaluate(element => element.requestSubmit());
    await page.waitForTimeout(30);
    check((await message.textContent() || "").toLowerCase().includes("соглас"), "form.consent-validation", contract.route);

    if (contract.submittedScenario) {
      await page.locator(`[data-scenario="${contract.submittedScenario}"]`).first().evaluate(element => element.click());
    }
    const optionalDetails = form.locator("details.optional-fields");
    if (await optionalDetails.count() && !await optionalDetails.first().getAttribute("open")) {
      await optionalDetails.first().locator("summary").click();
    }
    const niche = form.locator("[name='niche']");
    if (await niche.count()) await niche.fill("QA test, no external delivery");
    const name = form.locator("[name='name']");
    if (await name.count() && await name.first().getAttribute("type") !== "hidden") await name.fill("QA");
    await form.locator("[name='pd_consent']").check();
    await form.evaluate(element => element.requestSubmit());
    await page.waitForFunction(selector => document.querySelector(selector)?.disabled === true, `${contract.selector} button[type='submit'],${contract.selector} button`, { timeout: 2000 });
    await sent;
    await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent?.includes(text), { selector: contract.status, text: contract.successText });
    const goals = await page.evaluate(() => window.__qaGoals || []);
    const after = await form.evaluate(element => ({
      phone: element.elements.phone?.value || "",
      consent: Boolean(element.elements.pd_consent?.checked),
      scenario: element.elements.scenario?.value || null,
      disabled: Boolean(element.querySelector("button[type='submit']")?.disabled)
    }));

    check(payload?.product === contract.product, "form.product", `${contract.route}: ${payload?.product}`);
    check(payload?.route === contract.routeValue, "form.route", `${contract.route}: ${payload?.route}`);
    check(payload?.landing_variant === contract.landingVariant, "form.variant", `${contract.route}: ${payload?.landing_variant}`);
    check(payload?.form_id === contract.formId, "form.form-id", `${contract.route}: ${payload?.form_id}`);
    check(payload?.pd_consent === true, "form.pd-consent", contract.route);
    check(payload?.pd_consent_version === "planb-pd-2026-09-04-v2", "form.pd-version", contract.route);
    check(payload?.privacy_version === PRIVACY_VERSION, "form.privacy-version", contract.route);
    check(Number.isFinite(Date.parse(payload?.pd_consent_client_at)), "form.consent-time", contract.route);
    check(payload?.ts === payload?.pd_consent_client_at, "form.timestamp-match", contract.route);
    check(payload?.utm_source === "qa" && payload?.utm_medium === "automation" && payload?.utm_campaign === "sitewide" && payload?.utm_content === "form" && payload?.utm_term === "avito" && payload?.yclid === "qa-yclid", "form.attribution", contract.route);
    check(String(payload?.page || "").startsWith(baseURL + contract.route), "form.page", `${contract.route}: ${payload?.page}`);
    if (contract.submittedScenario) check(payload?.scenario === contract.submittedScenario, "form.scenario", `${contract.route}: ${payload?.scenario}`);
    check(after.phone === "" && !after.consent && !after.disabled, "form.success-reset", `${contract.route}: ${JSON.stringify(after)}`);
    if (contract.submittedScenario) check(after.scenario === "unspecified", "form.scenario-reset", `${contract.route}: ${after.scenario}`);
    check(goals.some(args => args[0] === 110884885 && args[1] === "reachGoal" && args[2] === "LEAD_FORM"), "form.goal", contract.route);
    report.forms.push({ route: contract.route, outcome, payload, after, goals, externalRequests });
  } else {
    await page.locator(contract.phone).fill("+7 999 123-45-67");
    await form.locator("[name='pd_consent']").check();
    await form.evaluate(element => element.requestSubmit());
    await sent;
    await page.waitForFunction(selector => document.querySelector(selector)?.classList.contains("bad"), contract.status);
    const state = await form.evaluate(element => ({
      phone: element.elements.phone?.value || "",
      consent: Boolean(element.elements.pd_consent?.checked),
      disabled: Boolean(element.querySelector("button[type='submit']")?.disabled)
    }));
    const fallbackLinks = await message.locator("a[href^='tel:'],a[href*='t.me'],a[href*='wa.me']").count();
    const goals = await page.evaluate(() => window.__qaGoals || []);
    check(state.phone.length > 0 && state.consent && !state.disabled, "form.failure-preserves", `${contract.route}: ${JSON.stringify(state)}`);
    check(fallbackLinks > 0, "form.failure-fallback", contract.route);
    check(!goals.some(args => args[1] === "reachGoal" && args[2] === "LEAD_FORM"), "form.failure-goal", contract.route);
    report.forms.push({ route: contract.route, outcome, payload, state, fallbackLinks, goals, externalRequests });
  }
  await context.close();
}

async function runForms(browser, baseURL) {
  for (const contract of FORM_CONTRACTS) {
    await formAttempt(browser, baseURL, contract, "success");
    await formAttempt(browser, baseURL, contract, "failure");
  }
}

async function runConsent(browser, baseURL) {
  const freshContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const freshPage = await freshContext.newPage();
  const freshExternal = [];
  await installPageRouting(freshPage, baseURL, freshExternal);
  await freshPage.goto(baseURL + "/", { waitUntil: "load" });
  await freshPage.waitForSelector("#planb-cookie");
  const initial = await freshPage.evaluate(key => ({
    stored: localStorage.getItem(key),
    activeChoice: document.activeElement?.getAttribute("data-choice") || "",
    role: document.querySelector("#planb-cookie")?.getAttribute("role"),
    labelledBy: document.querySelector("#planb-cookie")?.getAttribute("aria-labelledby"),
    describedBy: document.querySelector("#planb-cookie")?.getAttribute("aria-describedby"),
    analyticsScripts: document.querySelectorAll("script[data-planb-analytics]").length
  }), CONSENT_KEY);
  check(initial.stored === null && initial.activeChoice === "denied", "consent.initial-focus", JSON.stringify(initial));
  check(initial.role === "dialog" && initial.labelledBy && initial.describedBy, "consent.dialog-a11y", JSON.stringify(initial));
  check(initial.analyticsScripts === 0 && freshExternal.every(item => !/mc\.yandex\.ru/.test(item.url)), "consent.no-preload");
  await freshPage.evaluate(() => window.scrollTo({ top: 240, behavior: "instant" }));
  await freshPage.waitForTimeout(240);
  const dockAlongsideConsent = await freshPage.evaluate(() => {
    const dock = document.querySelector(".contact-dock.planb-contact-dock");
    const banner = document.querySelector("#planb-cookie");
    const style = dock && getComputedStyle(dock);
    if (!dock || !banner || !style) return null;
    const dockRect = dock.getBoundingClientRect();
    const bannerRect = banner.getBoundingClientRect();
    const overlaps = dockRect.left < bannerRect.right && dockRect.right > bannerRect.left && dockRect.top < bannerRect.bottom && dockRect.bottom > bannerRect.top;
    const links = [...dock.querySelectorAll("a[href]")].map(link => {
      const rect = link.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        width: rect.width,
        height: rect.height,
        insideViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
        hit: hit === link || link.contains(hit)
      };
    });
    return { visibility: style.visibility, pointerEvents: style.pointerEvents, opacity: Number.parseFloat(style.opacity), overlaps, links };
  });
  check(dockAlongsideConsent?.visibility === "visible" && dockAlongsideConsent?.pointerEvents !== "none" && dockAlongsideConsent?.opacity > 0.95, "contact.dock-visible-with-consent", JSON.stringify(dockAlongsideConsent));
  check(dockAlongsideConsent?.overlaps === false, "contact.dock-clear-of-consent", JSON.stringify(dockAlongsideConsent));
  check(dockAlongsideConsent?.links?.length === 3 && dockAlongsideConsent.links.every(link => link.width >= 44 && link.height >= 44 && link.insideViewport && link.hit), "contact.dock-usable-with-consent", JSON.stringify(dockAlongsideConsent));
  await freshPage.locator("[data-choice='denied']").click();
  const denied = await freshPage.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), CONSENT_KEY);
  check(denied?.schema === CONSENT_SCHEMA && denied?.version === CONSENT_VERSION && denied?.privacy_version === PRIVACY_VERSION && denied?.privacy_sha256 === PRIVACY_SHA256 && denied?.notice_sha256 === NOTICE_SHA256 && denied?.choice === "denied", "consent.denied-record", JSON.stringify(denied));
  check(Number.isFinite(denied?.expires_at) && denied.expires_at > Date.now(), "consent.denied-expiry", JSON.stringify(denied));
  await freshContext.close();

  const grantContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const grantPage = await grantContext.newPage();
  const grantExternal = [];
  await installPageRouting(grantPage, baseURL, grantExternal);
  await grantPage.goto(baseURL + "/?utm_source=qa-first&utm_medium=consent&utm_campaign=first-touch&yclid=qa-first-yclid", { waitUntil: "load" });
  await grantPage.locator("[data-choice='granted']").click();
  await grantPage.waitForFunction(() => window.__planbAnalyticsLoaded === true);
  const granted = await grantPage.evaluate(({ consentKey, attributionKey }) => ({
    state: JSON.parse(localStorage.getItem(consentKey) || "null"),
    attribution: window.PlanBAnalyticsConsent?.attribution?.() || null,
    storedAttribution: JSON.parse(sessionStorage.getItem(attributionKey) || "null"),
    scripts: document.querySelectorAll("script[data-planb-analytics]").length,
    label: document.querySelector("#planb-analytics-settings")?.getAttribute("aria-label"),
    calls: (window.ym?.a || []).map(args => Array.from(args))
  }), { consentKey: CONSENT_KEY, attributionKey: ATTRIBUTION_KEY });
  const initCall = granted.calls.find(args => args[0] === 110884885 && args[1] === "init");
  check(granted.state?.choice === "granted" && granted.scripts === 1 && granted.label === "Аналитика: разрешена", "consent.granted", JSON.stringify(granted));
  check(Boolean(initCall) && initCall[2]?.webvisor === true && initCall[2]?.clickmap === true, "consent.safe-init", JSON.stringify(initCall));
  check(granted.attribution?.utm_source === "qa-first" && granted.attribution?.utm_medium === "consent" && granted.attribution?.utm_campaign === "first-touch" && granted.attribution?.yclid === "qa-first-yclid", "consent.first-touch-attribution", JSON.stringify(granted.attribution));
  check(granted.storedAttribution?.schema === "planb-session-attribution-v1" && granted.storedAttribution?.utm_source === "qa-first", "consent.first-touch-stored", JSON.stringify(granted.storedAttribution));
  check(grantExternal.filter(item => /mc\.yandex\.ru/.test(item.url)).length === 1, "consent.single-loader", JSON.stringify(grantExternal));
  await grantPage.evaluate(() => {
    document.addEventListener("click", event => {
      if (event.target.closest(".planb-contact-dock a")) event.preventDefault();
    }, true);
    window.scrollTo({ top: 240, behavior: "instant" });
  });
  await grantPage.waitForTimeout(240);
  for (const selector of [
    ".planb-contact-dock .planb-contact-action--phone",
    ".planb-contact-dock .planb-contact-action--whatsapp",
    ".planb-contact-dock .planb-contact-action--telegram"
  ]) {
    await grantPage.locator(selector).click();
  }
  const contactGoals = await grantPage.evaluate(() => (window.ym?.a || [])
    .map(args => Array.from(args))
    .filter(args => args[1] === "reachGoal" && String(args[2] || "").startsWith("CONTACT_")));
  for (const [goal, targetType] of [["CONTACT_PHONE", "phone"], ["CONTACT_WHATSAPP", "whatsapp"], ["CONTACT_TELEGRAM", "telegram"]]) {
    const matches = contactGoals.filter(args => args[2] === goal);
    check(matches.length === 1 && matches[0]?.[3]?.target_type === targetType && matches[0]?.[3]?.route === "/", "analytics.contact-goal", `${goal}: ${JSON.stringify(matches)}`);
  }
  const serializedContactGoals = JSON.stringify(contactGoals);
  check(!/79281446617|Здравствуйте|консультац/i.test(serializedContactGoals), "analytics.contact-payload-safe", serializedContactGoals);
  await grantPage.locator("#planb-analytics-settings").click();
  await grantPage.locator("#planb-cookie [data-choice='denied']").click();
  await grantPage.waitForFunction(key => JSON.parse(localStorage.getItem(key) || "null")?.choice === "denied", CONSENT_KEY);
  await grantPage.waitForTimeout(150);
  const revoked = await grantPage.evaluate(({ consentKey, attributionKey }) => ({
    state: JSON.parse(localStorage.getItem(consentKey) || "null"),
    attribution: sessionStorage.getItem(attributionKey),
    scripts: document.querySelectorAll("script[data-planb-analytics]").length
  }), { consentKey: CONSENT_KEY, attributionKey: ATTRIBUTION_KEY });
  check(revoked.state?.choice === "denied" && revoked.attribution === null && revoked.scripts === 0, "consent.revoked", JSON.stringify(revoked));
  await grantContext.close();

  const tamperedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await tamperedContext.addInitScript(({ key, schema }) => localStorage.setItem(key, JSON.stringify({
    schema,
    version: "stale",
    privacy_version: "stale",
    choice: "granted",
    expires_at: Date.now() - 1
  })), { key: CONSENT_KEY, schema: CONSENT_SCHEMA });
  const tamperedPage = await tamperedContext.newPage();
  const tamperedExternal = [];
  await installPageRouting(tamperedPage, baseURL, tamperedExternal);
  await tamperedPage.goto(baseURL + "/", { waitUntil: "load" });
  await tamperedPage.waitForSelector("#planb-cookie");
  check(tamperedExternal.every(item => !/mc\.yandex\.ru/.test(item.url)), "consent.tampered-preload", JSON.stringify(tamperedExternal));
  await tamperedContext.close();

  report.consent = { initial, denied, granted, contactGoals, revoked, freshExternal, grantExternal, tamperedExternal };
}

async function runRedirects(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const contract of REDIRECT_CONTRACTS) {
    const page = await context.newPage();
    const external = [];
    await installPageRouting(page, baseURL, external);
    await page.goto(baseURL + contract.source + "?qa=1#marker", { waitUntil: "load" });
    await page.waitForURL(baseURL + contract.target + "?qa=1#marker", { timeout: 5000 });
    const finalURL = page.url();
    check(finalURL === baseURL + contract.target + "?qa=1#marker", "redirect.target", `${contract.source}: ${finalURL}`);
    report.redirects.push({ ...contract, finalURL });
    await page.close();
  }
  await context.close();
}

async function main() {
  await fs.mkdir(SCREENSHOTS, { recursive: true });
  await staticAudit();
  const running = await startServer({ root: SITE_ROOT, port: 0 });
  let browser;
  try {
    for (const route of ACTIVE_ROUTES) {
      const response = await fetch(running.baseURL + route);
      check(response.status === 200, "server.active-route", `${route}: ${response.status}`);
    }
    const missing = await fetch(running.baseURL + "/__qa_missing_route__");
    check(missing.status === 404, "server.404", String(missing.status));

    browser = await chromium.launch({ executablePath: CHROME, headless: true });
    await runRenderProfiles(browser, running.baseURL);
    await runContactStability(browser, running.baseURL);
    await runForms(browser, running.baseURL);
    await runConsent(browser, running.baseURL);
    await runRedirects(browser, running.baseURL);
  } catch (error) {
    check(false, "qa.unhandled", error.stack || String(error));
  } finally {
    if (browser) await browser.close();
    await running.close();
  }

  report.completedAt = new Date().toISOString();
  report.summary = {
    passed: failures.length === 0,
    failureCount: failures.length,
    warningCount: warnings.length,
    renderedRuns: report.profiles.length,
    formRuns: report.forms.length,
    redirectRuns: report.redirects.length
  };
  await fs.writeFile(path.join(OUT, "qa-report.json"), JSON.stringify(report, null, 2) + "\n");

  if (failures.length) {
    console.error(`FAIL: ${failures.length} contract violation(s)`);
    for (const failure of failures) console.error(`- ${failure}`);
    console.error(`Evidence: ${OUT}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: ${ACTIVE_ROUTES.length} active routes, ${report.profiles.length} rendered runs, ${report.forms.length} form runs`);
  console.log(`Evidence: ${OUT}`);
}

await main();
