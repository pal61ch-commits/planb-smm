import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const url = process.env.PLANB_QA_URL || "http://127.0.0.1:4518/";
const chrome = process.env.SCROLLCRAFT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const out = path.resolve("../../lab/home-clean");
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const results = [];
const failures = [];

function requireCheck(ok, message) {
  if (!ok) failures.push(message);
}

async function seedDeniedConsent(context) {
  await context.addInitScript(() => {
    const now = Date.now();
    localStorage.setItem("planb_analytics_consent_v2", JSON.stringify({
      schema: "planb-analytics-choice-v2",
      version: "planb-analytics-2026-09-02-v2",
      privacy_version: "planb-privacy-2026-09-04-v3",
      privacy_sha256: "5cf6b80085eab30dc1d0a3f0c3dbafbf530ad271e5e1d33250c1a0e25b5508c8",
      notice_sha256: "c8445b179e648ea1867d3f1ac00aac22d8266c0f14839b620f6648b0ca25e275",
      choice: "denied",
      decided_at: new Date(now).toISOString(),
      expires_at: now + 180 * 24 * 60 * 60 * 1000
    }));
  });
}

async function inspectRun(config) {
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    deviceScaleFactor: config.width <= 420 ? 2 : 1,
    reducedMotion: config.reduced ? "reduce" : "no-preference"
  });
  await seedDeniedConsent(context);
  const page = await context.newPage();
  const consoleErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => consoleErrors.push(String(error)));
  page.on("requestfailed", request => requestFailures.push((request.failure()?.errorText || "failed") + " " + request.url()));
  page.on("response", response => { if (response.status() >= 400) badResponses.push(response.status() + " " + response.url()); });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("html.sc-ready", { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);

  const base = await page.evaluate(() => {
    const form = document.querySelector("#leadForm");
    const analyticsControl = document.querySelector("#planb-analytics-settings");
    const analyticsRect = analyticsControl?.getBoundingClientRect();
    const contactEyebrow = document.querySelector("#contact .eyebrow");
    return {
      title: document.title,
      width: innerWidth,
      height: innerHeight,
      bodyScrollWidth: document.body.scrollWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      acts: document.querySelectorAll("[data-sc-act]").length,
      planes: document.querySelectorAll(".signal-plane").length,
      brokenImages: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src),
      missingAnchors: [...document.querySelectorAll("a[href^='#']")]
        .map(link => link.getAttribute("href"))
        .filter(href => href && href !== "#" && !document.querySelector(href)),
      form: form ? {
        id: form.id,
        formId: form.elements.form_id?.value,
        scenario: form.elements.scenario?.value,
        pdVersion: form.elements.pd_consent_version?.value,
        privacyVersion: form.elements.privacy_version?.value,
        requiredPhone: form.elements.phone?.required,
        requiredConsent: form.elements.pd_consent?.required,
        statusRole: document.querySelector("#leadMsg")?.getAttribute("role"),
        statusLive: document.querySelector("#leadMsg")?.getAttribute("aria-live")
      } : null,
      analyticsControl: analyticsControl ? {
        label: analyticsControl.getAttribute("aria-label"),
        title: analyticsControl.getAttribute("title"),
        width: analyticsRect.width,
        height: analyticsRect.height
      } : null,
      contactEyebrowColor: contactEyebrow ? getComputedStyle(contactEyebrow).color : null,
      copyContract: document.body.innerText.includes("До разбора не обещаем место в топе и число заявок"),
      engineInstances: window.ScrollCraft?.instances?.length || 0
    };
  });

  requireCheck(base.bodyScrollWidth <= config.width + 1 && base.rootScrollWidth <= config.width + 1, config.name + ": horizontal overflow");
  requireCheck(base.acts === 1, config.name + ": expected one flow act, got " + base.acts);
  requireCheck(base.planes === 3, config.name + ": expected three signal planes");
  requireCheck(base.brokenImages.length === 0, config.name + ": broken images " + base.brokenImages.join(", "));
  requireCheck(base.missingAnchors.length === 0, config.name + ": missing anchors " + base.missingAnchors.join(", "));
  requireCheck(base.engineInstances === 1, config.name + ": Scrollcraft did not mount exactly once");
  requireCheck(base.form?.formId === "leadForm" && base.form?.scenario === "unspecified", config.name + ": form identity changed");
  requireCheck(base.form?.pdVersion === "planb-pd-2026-09-04-v2", config.name + ": personal-data consent version changed");
  requireCheck(base.form?.privacyVersion === "planb-privacy-2026-09-04-v3", config.name + ": privacy version changed");
  requireCheck(base.form?.requiredPhone && base.form?.requiredConsent, config.name + ": required form controls changed");
  requireCheck(base.form?.statusRole === "status" && base.form?.statusLive === "polite", config.name + ": form status accessibility changed");
  requireCheck(base.analyticsControl?.label === "Настройки аналитики" && base.analyticsControl?.title === "Настройки аналитики", config.name + ": analytics settings label changed");
  requireCheck(base.analyticsControl?.width <= 44 && base.analyticsControl?.height <= 44, config.name + ": analytics settings control is no longer compact");
  requireCheck(base.contactEyebrowColor === "rgb(255, 210, 31)", config.name + ": contact eyebrow lost brand contrast");
  requireCheck(base.copyContract, config.name + ": honest promise boundary missing");

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: path.join(out, config.name + "-hero.png") });

  const sectionAudit = [];
  const sectionCount = await page.locator("main > section").count();
  for (let index = 0; index < sectionCount; index += 1) {
    await page.evaluate(sectionIndex => {
      const section = document.querySelectorAll("main > section")[sectionIndex];
      window.scrollTo({ top: Math.max(0, section.offsetTop - 112), behavior: "instant" });
    }, index);
    await page.waitForTimeout(config.reduced ? 280 : 720);
    sectionAudit.push(await page.evaluate(() => {
      const visible = [...document.querySelectorAll("[data-sc-in]")].filter(element => {
        const rect = element.getBoundingClientRect();
        const visiblePixels = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 110));
        const visibleRatio = visiblePixels / Math.max(1, Math.min(rect.height, innerHeight - 110));
        return visibleRatio >= 0.2;
      });
      return visible.map(element => ({
        text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
        opacity: Number.parseFloat(getComputedStyle(element).opacity)
      }));
    }));
  }
  const hiddenVisible = sectionAudit.flat().filter(item => item.opacity < 0.95);
  requireCheck(hiddenVisible.length === 0, config.name + ": visible reveal content stayed hidden " + JSON.stringify(hiddenVisible.slice(0, 3)));

  await page.locator("#contact").scrollIntoViewIfNeeded();
  await page.waitForTimeout(config.reduced ? 280 : 720);
  await page.screenshot({ path: path.join(out, config.name + "-contact.png") });

  let menuState = null;
  if (config.width <= 860) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const menu = page.locator(".menu-btn");
    await menu.click();
    menuState = await page.evaluate(() => ({
      expanded: document.querySelector(".menu-btn")?.getAttribute("aria-expanded"),
      navOpen: document.querySelector("#mainNav")?.classList.contains("open"),
      bodyOpen: document.body.classList.contains("menu-open"),
      navVisible: getComputedStyle(document.querySelector("#mainNav")).display !== "none"
    }));
    requireCheck(menuState.expanded === "true" && menuState.navOpen && menuState.bodyOpen && menuState.navVisible, config.name + ": mobile menu failed");
    await menu.click();
  }

  const reducedState = await page.evaluate(() => ({
    engine: Boolean(window.ScrollCraft?.reduce),
    pulseAnimation: getComputedStyle(document.querySelector(".signal-pulse")).animationName,
    hold: document.querySelector("[data-home-signal]")?.getAttribute("data-sc-verify-hold")
  }));
  if (config.reduced) {
    requireCheck(reducedState.engine && reducedState.pulseAnimation === "none" && reducedState.hold === "true", "reduced: moving signal did not settle");
  }

  let focusOrder = [];
  if (config.name === "desktop") {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press("Tab");
      focusOrder.push(await page.evaluate(() => {
        const active = document.activeElement;
        const style = getComputedStyle(active);
        return {
          tag: active.tagName,
          text: (active.textContent || active.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 70),
          visible: style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0,
          outline: style.outlineStyle
        };
      }));
    }
    requireCheck(focusOrder.every(item => item.visible), "desktop: keyboard reached a hidden target");
    requireCheck(focusOrder.some(item => item.outline !== "none"), "desktop: no visible focus outline observed");
  }

  requireCheck(consoleErrors.length === 0, config.name + ": console errors " + consoleErrors.join(" | "));
  requireCheck(requestFailures.length === 0, config.name + ": request failures " + requestFailures.join(" | "));
  requireCheck(badResponses.length === 0, config.name + ": HTTP errors " + badResponses.join(" | "));

  results.push({ config, base, menuState, reducedState, focusOrder, hiddenVisible, consoleErrors, requestFailures, badResponses });
  await context.close();
}

for (const config of [
  { name: "desktop", width: 1440, height: 900, reduced: false },
  { name: "laptop", width: 1280, height: 720, reduced: false },
  { name: "mobile", width: 390, height: 844, reduced: false },
  { name: "compact", width: 360, height: 640, reduced: false },
  { name: "reduced", width: 390, height: 844, reduced: true }
]) {
  await inspectRun(config);
}

const noJs = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
const noJsPage = await noJs.newPage();
await noJsPage.goto(url, { waitUntil: "load" });
const noJsState = await noJsPage.evaluate(() => ({
  scrollHeight: document.documentElement.scrollHeight,
  scrollWidth: document.documentElement.scrollWidth,
  width: innerWidth,
  hiddenReveals: [...document.querySelectorAll(".reveal,[data-sc-in]")].filter(element => Number(getComputedStyle(element).opacity) < 0.99).length,
  textLength: document.body.innerText.length,
  formVisible: Boolean(document.querySelector("#leadForm")) && getComputedStyle(document.querySelector("#leadForm")).display !== "none"
}));
requireCheck(noJsState.hiddenReveals === 0, "no-js: " + noJsState.hiddenReveals + " reveal elements hidden");
requireCheck(noJsState.scrollWidth <= noJsState.width + 1, "no-js: horizontal overflow");
requireCheck(noJsState.textLength > 5000 && noJsState.formVisible, "no-js: homepage content is incomplete");
await noJsPage.screenshot({ path: path.join(out, "no-js-hero.png") });
await noJs.close();

await browser.close();

const report = { url, generatedAt: new Date().toISOString(), results, noJsState, failures };
fs.writeFileSync(path.join(out, "qa-report.json"), JSON.stringify(report, null, 2) + "\n");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("PASS: " + results.length + " browser profiles plus no-JS fallback");
console.log("Evidence: " + out);
