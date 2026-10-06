import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { startServer } from "./server.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(HERE, "../../..");
const CHROME = process.env.SCROLLCRAFT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CONSENT = {
  key: "planb_analytics_consent_v3",
  schema: "planb-analytics-choice-v3",
  version: "planb-analytics-2026-09-29-v3",
  privacyVersion: "planb-privacy-2026-09-29-v4",
  privacyHash: "455d7155c3aa47424bb66daee7e8dd2492532a30c567e5f84e8634bbe853ee83",
  noticeHash: "567a90210a2d829edccf7b977e7727a4c0fd4b2e2b294826f4ccd574f2916270"
};
const ATTRIBUTION_KEY = "planb_session_attribution_v1";
const LEAD_ENDPOINT = "https://functions.yandexcloud.net/d4egi8sqig8ak86v89jg?tag=stable";
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
  const attribution = await page.evaluate(key => ({
    value: window.PlanBAnalyticsConsent.attribution(),
    stored: sessionStorage.getItem(key)
  }), ATTRIBUTION_KEY);
  assert.equal(attribution.value.utm_source, "private");
  assert.equal(attribution.stored, null);
  await context.close();
}

async function testGlobalEventsAndPayloads(browser, baseURL) {
  const context = await browser.newContext();
  await seedConsent(context, "granted");
  const page = await openTestPage(context, baseURL, "/blog/statistika-avito-crm-sdelki?utm_source=private&yclid=secret-id");
  const initCalls = await page.evaluate(() => (window.__analyticsTestCalls || [])
    .filter(args => args[0] === 110884885 && args[1] === "init"));
  assert.equal(initCalls.length, 1);
  assert.equal(initCalls[0][2].webvisor, false, "existing general consent does not opt in to recording");
  assert.equal(initCalls[0][2].clickmap, false);
  assert.equal(await page.locator("#planb-cookie").count(), 0, "existing valid consent must not be requested again");
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

async function testFirstTouchAttribution(browser, baseURL) {
  const context = await browser.newContext();
  await seedConsent(context, "granted");
  const page = await openTestPage(
    context,
    baseURL,
    "/blog/statistika-avito-crm-sdelki?utm_source=first&utm_medium=organic&utm_campaign=launch&utm_content=article&utm_term=avito&yclid=first-click"
  );
  const captured = await page.evaluate(key => ({
    value: window.PlanBAnalyticsConsent.attribution(),
    stored: JSON.parse(sessionStorage.getItem(key) || "null")
  }), ATTRIBUTION_KEY);
  assert.equal(captured.stored.schema, "planb-session-attribution-v1");
  assert.equal(captured.stored.utm_source, "first");
  assert.deepEqual(captured.value, {
    utm_source: "first",
    utm_medium: "organic",
    utm_campaign: "launch",
    utm_content: "article",
    utm_term: "avito",
    yclid: "first-click"
  });

  await page.goto(baseURL + "/uslugi/vedenie-avito?utm_source=later&utm_campaign=retargeting&yclid=later-click", { waitUntil: "load" });
  const carried = await page.evaluate(() => window.PlanBAnalyticsConsent.attribution());
  assert.deepEqual(carried, captured.value);
  await context.close();
}

async function testExpandedContentSelectors(browser, baseURL) {
  const context = await browser.newContext();
  await seedConsent(context, "granted");
  const page = await openTestPage(context, baseURL, "/blog/statistika-avito-crm-sdelki");
  await page.evaluate(() => {
    document.body.insertAdjacentHTML("beforeend", `
      <a id="qa-post-card" class="post-card" href="/blog/skolko-stoit-prodvizhenie-avito">Post</a>
      <a id="qa-case-card" class="case-feature-card" href="/kejsy/metalloprokat">Case</a>
      <div class="video-links"><a id="qa-video-link" href="https://video.example.test/watch">Video source</a></div>
      <a id="qa-social-card" class="social-card" href="https://www.instagram.com/avitolog_planb_prodvizenie/">Social</a>
    `);
  });
  const scenarios = [
    ["#qa-post-card", "blog", "127.0.0.1"],
    ["#qa-case-card", "case", "127.0.0.1"],
    ["#qa-video-link", "external", "video.example.test"],
    ["#qa-social-card", "external", "instagram.com"]
  ];
  for (const [selector, targetType, targetHost] of scenarios) {
    await page.evaluate(() => { window.__analyticsTestCalls = []; });
    await page.locator(selector).click();
    const calls = await trackedCalls(page);
    const content = callFor(calls, "CONTENT_CTA");
    assertSafeCall(content);
    assert.equal(content[3].target_type, targetType);
    assert.equal(content[3].target_host, targetHost);
  }
  await context.close();
}

async function testFormsUseFirstTouchAttribution(browser, baseURL) {
  const contracts = [
    ["/", "#leadForm", "#leadPhone"],
    ["/uslugi/vedenie-avito", "#serviceLead", "#serviceLeadPhone"],
    ["/uslugi/razovaya-nastroyka-avito", "#setupLead", "#setupLeadPhone"]
  ];
  for (const [route, formSelector, phoneSelector] of contracts) {
    const context = await browser.newContext();
    await seedConsent(context, "granted");
    const page = await openTestPage(
      context,
      baseURL,
      "/blog/statistika-avito-crm-sdelki?utm_source=first-form&utm_medium=organic&utm_campaign=forms&utm_content=article&utm_term=avito&yclid=form-first-click"
    );
    let resolvePayload;
    const payloadPromise = new Promise(resolve => { resolvePayload = resolve; });
    await page.route(LEAD_ENDPOINT, async intercepted => {
      resolvePayload(intercepted.request().postDataJSON());
      await intercepted.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ ok: true })
      });
    });
    await page.goto(baseURL + route, { waitUntil: "load" });
    await page.locator(phoneSelector).fill("+7 999 123-45-67");
    await page.locator(`${formSelector} [name="pd_consent"]`).check();
    await page.locator(formSelector).evaluate(form => form.requestSubmit());
    const payload = await payloadPromise;
    assert.equal(payload.privacy_version, CONSENT.privacyVersion);
    assert.equal(payload.utm_source, "first-form");
    assert.equal(payload.utm_medium, "organic");
    assert.equal(payload.utm_campaign, "forms");
    assert.equal(payload.utm_content, "article");
    assert.equal(payload.utm_term, "avito");
    assert.equal(payload.yclid, "form-first-click");
    await context.close();
  }
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

async function testConsentAcrossSiteRoutes(browser, baseURL) {
  for (const choice of ["granted", "denied"]) {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.__analyticsTestCalls = [];
      window.ym = (...args) => window.__analyticsTestCalls.push(args);
    });
    const page = await context.newPage();
    let analyticsRequests = 0;
    await page.route("https://mc.yandex.ru/**", request => {
      analyticsRequests++;
      return request.fulfill({ status: 200, contentType: "application/javascript", body: "" });
    });
    await page.goto(baseURL + "/", { waitUntil: "load" });
    assert.equal(await page.locator("#planb-cookie").count(), 1);
    assert.equal(await page.locator("#planb-cookie-title").textContent(), "Аналитика сайта");
    assert.equal(await page.locator("#planb-cookie details").getAttribute("open"), null);
    assert.equal(await page.locator("#planb-recording-consent").isChecked(), false);
    assert.equal(analyticsRequests, 0, "analytics must not load before a choice");
    await page.locator(`[data-choice="${choice}"]`).click();
    const saved = await page.evaluate(key => localStorage.getItem(key), CONSENT.key);
    assert.equal(JSON.parse(saved).choice, choice);
    assert.equal(JSON.parse(saved).session_recording, false);
    for (const route of ["/prodvizhenie-instagram", "/"]) {
      await page.goto(baseURL + route, { waitUntil: "load" });
      assert.equal(await page.locator("#planb-cookie").count(), 0, `no repeat consent on ${route}`);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), CONSENT.key), saved,
        "route changes must preserve the original choice and expiry without rewriting it");
      assert.equal(await page.locator("script[data-planb-analytics]").count(), choice === "granted" ? 1 : 0);
      const init = await page.evaluate(() => window.__analyticsTestCalls.filter(args => args[1] === "init"));
      assert.equal(init.length, choice === "granted" ? 1 : 0);
      if (init.length) {
        assert.equal(init[0][2].webvisor, false);
        assert.equal(init[0][2].clickmap, false);
      }
    }
    if (choice === "denied") assert.equal(analyticsRequests, 0, "declined analytics must never be requested");
    await context.close();
  }
}

async function testSeparateRecordingChoice(browser, baseURL) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__analyticsTestCalls = [];
    window.ym = (...args) => window.__analyticsTestCalls.push(args);
  });
  const page = await context.newPage();
  await page.route("https://mc.yandex.ru/**", request => request.fulfill({
    status: 200, contentType: "application/javascript", body: ""
  }));
  await page.goto(baseURL + "/prodvizhenie-instagram", { waitUntil: "load" });
  await page.locator("#planb-cookie summary").click();
  await page.locator("#planb-recording-consent").check();
  assert.equal(await page.locator("script[data-planb-analytics]").count(), 0,
    "checking recording alone must not load analytics before saving consent");
  await page.locator('[data-choice="granted"]').click();
  let init = await page.evaluate(() => window.__analyticsTestCalls.filter(args => args[1] === "init"));
  assert.equal(init.length, 1);
  assert.equal(init[0][2].webvisor, true);
  assert.equal(init[0][2].clickmap, true);
  await page.goto(baseURL + "/", { waitUntil: "load" });
  assert.equal(await page.locator("#planb-cookie").count(), 0);
  await page.locator("#planb-analytics-settings").click();
  assert.equal(await page.locator("#planb-recording-consent").isChecked(), true);
  await page.locator("#planb-recording-consent").uncheck();
  await Promise.all([
    page.waitForEvent("load"),
    page.locator('[data-choice="granted"]').click()
  ]);
  assert.equal(await page.locator("#planb-cookie").count(), 0);
  const state = await page.evaluate(() => window.PlanBAnalyticsConsent.state());
  assert.equal(state.choice, "granted");
  assert.equal(state.session_recording, false);
  init = await page.evaluate(() => window.__analyticsTestCalls.filter(args => args[1] === "init"));
  assert.equal(init.length, 1);
  assert.equal(init[0][2].webvisor, false);
  assert.equal(init[0][2].clickmap, false);
  await context.close();
}

const running = await startServer({ root: SITE_ROOT, port: 0 });
let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  await testDeniedConsent(browser, running.baseURL);
  await testGlobalEventsAndPayloads(browser, running.baseURL);
  await testFirstTouchAttribution(browser, running.baseURL);
  await testExpandedContentSelectors(browser, running.baseURL);
  await testFormsUseFirstTouchAttribution(browser, running.baseURL);
  await testLegacyContactsAreSafeAndNotDuplicated(browser, running.baseURL);
  await testConsentAcrossSiteRoutes(browser, running.baseURL);
  await testSeparateRecordingChoice(browser, running.baseURL);
  console.log("PASS analytics-consent: consent gate, preserved cross-route choices and expiry, separate recording opt-in/revocation, first-touch attribution, CTA mapping, safe payloads, and deduplication");
} finally {
  if (browser) await browser.close();
  await running.close();
}
