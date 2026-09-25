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
const CHROME = process.env.SCROLLCRAFT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.resolve(HERE, "../../lab/planb-site");
const SCREENSHOTS = path.join(OUT, "screenshots");
const LEAD_HOST = "functions.yandexcloud.net";
const LEAD_PATH = "/d4egi8sqig8ak86v89jg";
const CONSENT_KEY = "planb_analytics_consent_v2";
const CONSENT_VERSION = "planb-analytics-2026-09-02-v2";
const PRIVACY_VERSION = "planb-privacy-2026-09-04-v3";
const PRIVACY_SHA256 = "5cf6b80085eab30dc1d0a3f0c3dbafbf530ad271e5e1d33250c1a0e25b5508c8";
const NOTICE_SHA256 = "c8445b179e648ea1867d3f1ac00aac22d8266c0f14839b620f6648b0ca25e275";

const failures = [];
const warnings = [];
const report = {
  generatedAt: new Date().toISOString(),
  siteRoot: SITE_ROOT,
  baselineRoot: BASELINE_ROOT,
  scope: {
    marketing: MARKETING_ROUTES.length,
    currentLegal: CURRENT_LEGAL_ROUTES.length,
    immutable: IMMUTABLE_FILES.length,
    active: ACTIVE_ROUTES.length
  },
  static: {},
  profiles: [],
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

async function seedDeniedConsent(context) {
  await context.addInitScript(({ key, version, privacyVersion, privacyHash, noticeHash }) => {
    const now = Date.now();
    localStorage.setItem(key, JSON.stringify({
      schema: "planb-analytics-choice-v2",
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
  check(MARKETING_ROUTES.length === 38, "scope.marketing", `expected 38, got ${MARKETING_ROUTES.length}`);
  check(CURRENT_LEGAL_ROUTES.length === 5, "scope.current-legal", `expected 5, got ${CURRENT_LEGAL_ROUTES.length}`);
  check(VERSIONED_LEGAL_FILES.length === 6, "scope.versioned-legal", `expected 6, got ${VERSIONED_LEGAL_FILES.length}`);
  check(REDIRECT_CONTRACTS.length === 4, "scope.redirects", `expected 4, got ${REDIRECT_CONTRACTS.length}`);
  check(VERIFICATION_FILES.length === 4, "scope.verification", `expected 4, got ${VERIFICATION_FILES.length}`);
  check(SOKRAT_FILES.length === 5, "scope.sokrat", `expected 5, got ${SOKRAT_FILES.length}`);
  check(new Set(ACTIVE_ROUTES).size === ACTIVE_ROUTES.length, "scope.active-duplicates");
  check(new Set(IMMUTABLE_FILES).size === IMMUTABLE_FILES.length, "scope.immutable-duplicates");

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

  const active = [];
  const localLinkFailures = [];
  for (const route of ACTIVE_ROUTES) {
    const relative = routeToRelativeFile(route);
    const candidate = path.join(SITE_ROOT, relative);
    const baseline = path.join(BASELINE_ROOT, relative);
    const candidateExists = await exists(candidate);
    const baselineExists = await exists(baseline);
    check(candidateExists, "active.missing-candidate", `${route} -> ${relative}`);
    check(baselineExists, "active.missing-baseline", `${route} -> ${relative}`);
    if (!candidateExists) continue;
    const html = await fs.readFile(candidate, "utf8");
    const marketing = MARKETING_ROUTES.includes(route);
    const expected = expectedCanonical(route);

    check(tagContent(html, "title").length > 0, "seo.title", route);
    check(metaContent(html, "description").length > 0, "seo.description", route);
    check(canonicalHref(html) === expected, "seo.canonical", `${route} expected ${expected}, got ${canonicalHref(html)}`);

    try {
      const values = jsonLdValues(html);
      if (marketing) check(values.length >= 1, "seo.jsonld-missing", route);
    } catch (error) {
      check(false, "seo.jsonld-invalid", `${route}: ${error.message}`);
    }

    if (baselineExists) {
      const baselineHtml = await fs.readFile(baseline, "utf8");
      check(tagContent(html, "title") === tagContent(baselineHtml, "title"), "seo.title-drift", route);
      check(metaContent(html, "description") === metaContent(baselineHtml, "description"), "seo.description-drift", route);
      check(canonicalHref(html) === canonicalHref(baselineHtml), "seo.canonical-drift", route);
      try {
        const actualJson = JSON.stringify(normalizeJson(jsonLdValues(html)));
        const baselineJson = JSON.stringify(normalizeJson(jsonLdValues(baselineHtml)));
        check(actualJson === baselineJson, "seo.jsonld-drift", route);
      } catch (error) {
        check(false, "seo.jsonld-baseline", `${route}: ${error.message}`);
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
  check(sitemapUrls.length === 41, "sitemap.count", `expected 41, got ${sitemapUrls.length}`);
  check(new Set(sitemapUrls).size === sitemapUrls.length, "sitemap.duplicates");
  check(expectedSitemap.every(url => sitemapUrls.includes(url)), "sitemap.missing", expectedSitemap.filter(url => !sitemapUrls.includes(url)).join(", "));
  check(sitemapUrls.every(url => expectedSitemap.includes(url)), "sitemap.unexpected", sitemapUrls.filter(url => !expectedSitemap.includes(url)).join(", "));

  report.static = { active, immutable, localLinkFailures, sitemapUrls };
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
    const targets = [...document.querySelectorAll(".reveal,[data-sc-in]")];
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
      scrollcraftStyles: localStyles.filter(value => value === "/assets/scrollcraft.css").length,
      homeStyles: localStyles.filter(value => value === "/assets/home-depth.css").length,
      siteStyles: localStyles.filter(value => value === "/assets/site-depth.css").length,
      legalStyles: localStyles.filter(value => value === "/assets/legal-depth.css").length,
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
  await freshPage.locator("[data-choice='denied']").click();
  const denied = await freshPage.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), CONSENT_KEY);
  check(denied?.schema === "planb-analytics-choice-v2" && denied?.version === CONSENT_VERSION && denied?.privacy_version === PRIVACY_VERSION && denied?.privacy_sha256 === PRIVACY_SHA256 && denied?.notice_sha256 === NOTICE_SHA256 && denied?.choice === "denied", "consent.denied-record", JSON.stringify(denied));
  check(Number.isFinite(denied?.expires_at) && denied.expires_at > Date.now(), "consent.denied-expiry", JSON.stringify(denied));
  await freshContext.close();

  const grantContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const grantPage = await grantContext.newPage();
  const grantExternal = [];
  await installPageRouting(grantPage, baseURL, grantExternal);
  await grantPage.goto(baseURL + "/", { waitUntil: "load" });
  await grantPage.locator("[data-choice='granted']").click();
  await grantPage.waitForFunction(() => window.__planbAnalyticsLoaded === true);
  const granted = await grantPage.evaluate(key => ({
    state: JSON.parse(localStorage.getItem(key) || "null"),
    scripts: document.querySelectorAll("script[data-planb-analytics]").length,
    label: document.querySelector("#planb-analytics-settings")?.getAttribute("aria-label"),
    calls: (window.ym?.a || []).map(args => Array.from(args))
  }), CONSENT_KEY);
  const initCall = granted.calls.find(args => args[0] === 110884885 && args[1] === "init");
  check(granted.state?.choice === "granted" && granted.scripts === 1 && granted.label === "Аналитика: разрешена", "consent.granted", JSON.stringify(granted));
  check(Boolean(initCall) && initCall[2]?.webvisor === false && initCall[2]?.clickmap === false, "consent.safe-init", JSON.stringify(initCall));
  check(grantExternal.filter(item => /mc\.yandex\.ru/.test(item.url)).length === 1, "consent.single-loader", JSON.stringify(grantExternal));
  await grantPage.locator("#planb-analytics-settings").click();
  await grantPage.locator("#planb-cookie [data-choice='denied']").click();
  await grantPage.waitForFunction(key => JSON.parse(localStorage.getItem(key) || "null")?.choice === "denied", CONSENT_KEY);
  await grantPage.waitForTimeout(150);
  const revoked = await grantPage.evaluate(key => ({
    state: JSON.parse(localStorage.getItem(key) || "null"),
    scripts: document.querySelectorAll("script[data-planb-analytics]").length
  }), CONSENT_KEY);
  check(revoked.state?.choice === "denied" && revoked.scripts === 0, "consent.revoked", JSON.stringify(revoked));
  await grantContext.close();

  const tamperedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await tamperedContext.addInitScript(key => localStorage.setItem(key, JSON.stringify({
    schema: "planb-analytics-choice-v2",
    version: "stale",
    privacy_version: "stale",
    choice: "granted",
    expires_at: Date.now() - 1
  })), CONSENT_KEY);
  const tamperedPage = await tamperedContext.newPage();
  const tamperedExternal = [];
  await installPageRouting(tamperedPage, baseURL, tamperedExternal);
  await tamperedPage.goto(baseURL + "/", { waitUntil: "load" });
  await tamperedPage.waitForSelector("#planb-cookie");
  check(tamperedExternal.every(item => !/mc\.yandex\.ru/.test(item.url)), "consent.tampered-preload", JSON.stringify(tamperedExternal));
  await tamperedContext.close();

  report.consent = { initial, denied, granted, revoked, freshExternal, grantExternal, tamperedExternal };
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
