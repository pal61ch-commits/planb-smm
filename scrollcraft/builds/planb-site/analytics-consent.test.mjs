import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { startServer } from "./server.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(HERE, "../../..");
const CHROME = process.env.SCROLLCRAFT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CONSENT = {
  key: "planb_analytics_consent_v2",
  schema: "planb-analytics-choice-v2",
  version: "planb-analytics-2026-09-02-v2",
  privacyVersion: "planb-privacy-2026-09-04-v3",
  privacyHash: "5cf6b80085eab30dc1d0a3f0c3dbafbf530ad271e5e1d33250c1a0e25b5508c8",
  noticeHash: "c8445b179e648ea1867d3f1ac00aac22d8266c0f14839b620f6648b0ca25e275"
};
const TRACKED_GOALS = new Set([
  "CONTACT_PHONE",
  "CONTACT_TELEGRAM",
  "CONTACT_WHATSAPP",
  "CONTENT_CTA",
  "VIDEO_PLAY",
  "LEAD_FORM"
]);
const SAFE_PARAMETER_KEYS = new Set(["route", "content_id", "target_type", "target_host"]);

async function seedConsent(context, choice) {
  await context.addInitScript(({ consent, choiceValue }) => {
    const now = Date.now();
    localStorage.setItem(consent.key, JSON.stringify({
      schema: consent.schema,
      version: consent.version,
      privacy_version: consent.privacyVersion,
      privacy_sha256: consent.privacyHash,
      notice_sha256: consent.noticeHash,
      choice: choiceValue,
      decided_at: new Date(now).toISOString(),
      expires_at: now + 180 * 24 * 60 * 60 * 1000
    }));
  }, { consent: CONSENT, choiceValue: choice });
  await context.addInitScript(() => {
    window.__analyticsTestCalls = [];
    window.ym = (...args) => window.__analyticsTestCalls.push(args);
  });
}

async function openTestPage(context, baseURL, route) {
  const page = await context.newPage();
  await page.route("https://mc.yandex.ru/**", request => request.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: ""
  }));
  await page.goto(baseURL + route, { waitUntil: "load" });
  await page.evaluate(() => {
    document.addEventListener("click", event => event.preventDefault(), true);
  });
  return page;
}

async function trackedCalls(page) {
  return page.evaluate(goalIds => (window.__analyticsTestCalls || [])
    .filter(args => args[0] === 110884885 && args[1] === "reachGoal" && goalIds.includes(args[2])), [...TRACKED_GOALS]);
}

function assertSafeCall(call) {
  const [counter, method, goal, parameters] = call;
  assert.equal(counter, 110884885);
  assert.equal(method, "reachGoal");
  assert.ok(TRACKED_GOALS.has(goal));
  assert.ok(parameters && typeof parameters === "object");
  assert.deepEqual(Object.keys(parameters).filter(key => !SAFE_PARAMETER_KEYS.has(key)), []);
  assert.match(parameters.route, /^\/[^?#]*$/);
  if (parameters.content_id) assert.match(parameters.content_id, /^[a-z0-9_-]{1,80}$/);
  if (parameters.target_type) assert.match(parameters.target_type, /^[a-z0-9_-]{1,32}$/);
  if (parameters.target_host) assert.match(parameters.target_host, /^[a-z0-9.-]{1,120}$/);
  const serialized = JSON.stringify(parameters);
  assert.doesNotMatch(serialized, /79281446617|79991234567|secret-id|utm_|yclid|\?start=|https?:\/\//i);
}

function callFor(calls, goal) {
  const matches = calls.filter(call => call[2] === goal);
  assert.equal(matches.length, 1, `${goal} must be emitted exactly once`);
  return matches[0];
}

async function testDeniedConsent(browser, baseURL) {
  const context = await browser.newContext();
  await seedConsent(context, "denied");
  const page = await openTestPage(context, baseURL, "/blog/statistika-avito-crm-sdelki?utm_source=private");
  await page.evaluate(() => {
    document.body.insertAdjacentHTML("beforeend", `
      <a id="qa-phone" href="tel:+79991234567">Phone</a>
      <a id="qa-telegram" href="https://t.me/private_person?start=secret-id">Telegram</a>
      <a id="qa-whatsapp" href="https://wa.me/79991234567?text=private">WhatsApp</a>
    `);
  });
  for (const selector of ["#qa-phone", "#qa-telegram", "#qa-whatsapp"]) await page.locator(selector).click();
  await page.locator("video").evaluate(video => video.dispatchEvent(new Event("play")));
  await page.evaluate(() => window.PlanBAnalyticsConsent.track("lead_success", { phone: "+7 999 123-45-67" }));
  assert.deepEqual(await trackedCalls(page), []);
  assert.equal(await page.locator("script[data-planb-analytics]").count(), 0);
  await context.close();
}

async function testGlobalEventsAndPayloads(browser, baseURL) {
  const context = await browser.newContext();
  await seedConsent(context, "granted");
  const page = await openTestPage(context, baseURL, "/blog/statistika-avito-crm-sdelki?utm_source=private&yclid=secret-id");
  await page.evaluate(() => {
    document.body.insertAdjacentHTML("beforeend", `
      <a id="qa-phone" href="tel:+79991234567">Phone</a>
      <a id="qa-telegram" href="https://t.me/private_person?start=secret-id">Telegram</a>
      <a id="qa-whatsapp" href="https://wa.me/79991234567?text=private">WhatsApp</a>
      <a id="qa-content" class="more-card" href="/blog/skolko-stoit-prodvizhenie-avito?utm_source=private">Content</a>
      <a id="qa-inline" href="/blog/skolko-stoit-prodvizhenie-avito">Inline reference</a>
    `);
  });
  for (const selector of ["#qa-phone", "#qa-telegram", "#qa-whatsapp", "#qa-content", "#qa-inline"]) await page.locator(selector).click();
  await page.locator("video").evaluate(video => {
    video.dispatchEvent(new Event("play"));
    video.dispatchEvent(new Event("play"));
  });
  await page.evaluate(() => {
    const unsafe = {
      phone: "+7 999 123-45-67",
      href: "https://example.test/?secret-id",
      route: "/wrong?secret-id",
      target_type: "form"
    };
    window.PlanBAnalyticsConsent.track("lead_success", unsafe);
    window.PlanBAnalyticsConsent.track("LEAD_FORM", unsafe);
  });

  const calls = await trackedCalls(page);
  assert.equal(calls.length, 6);
  calls.forEach(assertSafeCall);

  const phone = callFor(calls, "CONTACT_PHONE")[3];
  assert.equal(phone.target_type, "phone");
  assert.equal(phone.target_host, undefined);

  const telegram = callFor(calls, "CONTACT_TELEGRAM")[3];
  assert.equal(telegram.target_type, "telegram");
  assert.equal(telegram.target_host, "t.me");

  const whatsapp = callFor(calls, "CONTACT_WHATSAPP")[3];
  assert.equal(whatsapp.target_type, "whatsapp");
  assert.equal(whatsapp.target_host, "wa.me");

  const content = callFor(calls, "CONTENT_CTA")[3];
  assert.equal(content.content_id, "blog_statistika-avito-crm-sdelki");
  assert.equal(content.target_type, "blog");

  const video = callFor(calls, "VIDEO_PLAY")[3];
  assert.equal(video.content_id, "kejs-metalloprokat-126-kontaktov");
  assert.equal(video.target_type, "video");

  const lead = callFor(calls, "LEAD_FORM")[3];
  assert.equal(lead.target_type, "form");
  assert.equal(lead.route, "/blog/statistika-avito-crm-sdelki");
  await context.close();
}

async function testLegacyContactsAreSafeAndNotDuplicated(browser, baseURL) {
  const scenarios = [
    {
      route: "/uslugi/vedenie-avito?utm_source=private-person&utm_content=phone-79991234567&yclid=secret-id",
      selectors: [".contact-link.call", ".contact-link.tg", ".contact-link.wa"]
    },
    {
      route: "/uslugi/razovaya-nastroyka-avito?utm_source=private-person&utm_content=phone-79991234567&yclid=secret-id",
      selectors: ['[data-contact="phone"]', '[data-contact="telegram"]', '[data-contact="whatsapp"]']
    }
  ];
  for (const scenario of scenarios) {
    const context = await browser.newContext();
    await seedConsent(context, "granted");
    const page = await openTestPage(context, baseURL, scenario.route);
    for (const selector of scenario.selectors) await page.locator(selector).first().click();
    const calls = await trackedCalls(page);
    assert.equal(calls.length, 3);
    calls.forEach(assertSafeCall);
    callFor(calls, "CONTACT_PHONE");
    callFor(calls, "CONTACT_TELEGRAM");
    callFor(calls, "CONTACT_WHATSAPP");
    await context.close();
  }
}

const running = await startServer({ root: SITE_ROOT, port: 0 });
let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  await testDeniedConsent(browser, running.baseURL);
  await testGlobalEventsAndPayloads(browser, running.baseURL);
  await testLegacyContactsAreSafeAndNotDuplicated(browser, running.baseURL);
  console.log("PASS analytics-consent: consent gate, goal mapping, safe payloads, and deduplication");
} finally {
  if (browser) await browser.close();
  await running.close();
}
