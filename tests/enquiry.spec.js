import { test, expect } from '@playwright/test';
import {
  enquiryEndpoint, mockVisits, openPlan, fillEnquiry, futureMonth,
  futureSaturday, assertRetainedEnquiry, successResponse, testEmail, uuidPattern,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await mockVisits(page);
});

test('sends the enquiry contract, prevents duplicate clicks, and shows a server reference', async ({ page }) => {
  const requests = [];
  let pending;
  await page.route(enquiryEndpoint, route => {
    requests.push(route.request().postDataJSON());
    pending = route;
  });
  await openPlan(page);
  await fillEnquiry(page);
  await page.locator('#submit-enquiry').dblclick();
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.locator('#submit-enquiry')).toBeDisabled();
  await expect(page.locator('#success-panel')).not.toBeVisible();
  expect(requests[0]).toMatchObject({
    email: testEmail,
    name: 'Browser acceptance test',
    destination: 'Croatia',
    dateMode: 'flexible',
    month: futureMonth(),
    durationWeeks: 1,
    guests: 6,
    skipper: 'needed',
    budget: '5000-8000',
    notes: 'Planning a one-week sailing holiday with six adults.',
    source: 'browser-test',
    consent: true,
    website: '',
  });
  expect(requests[0].requestId).toMatch(uuidPattern);
  expect(requests[0].startDate ?? '').toBe('');
  await successResponse(pending);
  await expect(page.locator('#success-panel')).toBeVisible();
  await expect(page.locator('#enquiry-reference')).toHaveText('SS-TEST-12345678');
  await expect(page.locator('#success-panel')).toBeFocused();
  expect(requests).toHaveLength(1);
});

test('network failure preserves the enquiry and retries the same idempotency key', async ({ page }) => {
  const requests = [];
  await page.route(enquiryEndpoint, async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) return route.abort('connectionreset');
    return successResponse(route, 200, 'SS-REPLAY-12345678');
  });
  await openPlan(page);
  await fillEnquiry(page);
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#submission-status')).toBeVisible();
  await expect(page.locator('#submission-status')).toBeFocused();
  await assertRetainedEnquiry(page);
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#success-panel')).toBeVisible();
  await expect(page.locator('#enquiry-reference')).toHaveText('SS-REPLAY-12345678');
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
});

test('timeout preserves entered details and the same request ID for a retry', async ({ page }) => {
  test.setTimeout(45_000);
  const requests = [];
  await page.route(enquiryEndpoint, async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length > 1) await successResponse(route);
  });
  await openPlan(page);
  await fillEnquiry(page);
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#submission-status')).toBeFocused({ timeout: 25_000 });
  await assertRetainedEnquiry(page);
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#success-panel')).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
});

for (const status of [429, 503]) {
  test(`HTTP ${status} remains a retryable error and never claims success`, async ({ page }) => {
    const requests = [];
    await page.route(enquiryEndpoint, async route => {
      requests.push(route.request().postDataJSON());
      if (requests.length > 1) return successResponse(route);
      await route.fulfill({
        status, contentType: 'application/problem+json',
        body: JSON.stringify({ title: 'Please try again later.', status }),
      });
    });
    await openPlan(page);
    await fillEnquiry(page);
    await page.locator('#submit-enquiry').click();
    await expect(page.locator('#submission-status')).toBeFocused();
    await assertRetainedEnquiry(page);
    await page.locator('#submit-enquiry').click();
    await expect(page.locator('#success-panel')).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
  });
}

for (const response of [
  { name: 'invalid JSON', status: 201, body: '{invalid' },
  { name: 'missing reference', status: 201, body: JSON.stringify({ receivedAt: '2026-11-01T10:00:00Z' }) },
  { name: 'blank reference', status: 201, body: JSON.stringify({ reference: ' ', receivedAt: '2026-11-01T10:00:00Z' }) },
  { name: 'non-string reference', status: 201, body: JSON.stringify({ reference: 123, receivedAt: '2026-11-01T10:00:00Z' }) },
  { name: 'unconfirmed 202 response', status: 202, body: JSON.stringify({ reference: 'SS-TEST-12345678', receivedAt: '2026-11-01T10:00:00Z' }) },
  { name: 'missing receipt timestamp', status: 201, body: JSON.stringify({ reference: 'SS-TEST-12345678' }) },
  { name: 'invalid receipt timestamp', status: 201, body: JSON.stringify({ reference: 'SS-TEST-12345678', receivedAt: 'not-a-date' }) },
]) {
  test(`${response.name} never displays false success`, async ({ page }) => {
    await page.route(enquiryEndpoint, route => route.fulfill({
      status: response.status, contentType: 'application/json', body: response.body,
    }));
    await openPlan(page);
    await fillEnquiry(page);
    await page.locator('#submit-enquiry').click();
    await expect(page.locator('#submission-status')).toBeFocused();
    await assertRetainedEnquiry(page);
  });
}

test('requires privacy consent, gives keyboard-accessible errors and sends no invalid request', async ({ page }) => {
  const requests = [];
  await page.route(enquiryEndpoint, route => {
    requests.push(route.request().postDataJSON());
    return successResponse(route);
  });
  await openPlan(page);
  await fillEnquiry(page);
  await page.locator('#consent').uncheck();
  await page.locator('#submit-enquiry').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#form-errors')).toBeVisible();
  await expect(page.locator('#form-errors')).toBeFocused();
  await expect(page.locator('#consent')).toHaveAttribute('aria-invalid', 'true');
  expect(requests).toHaveLength(0);
  await page.locator('#form-errors a').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#consent')).toBeFocused();
  await page.keyboard.press('Space');
  await page.locator('#submit-enquiry').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#success-panel')).toBeFocused();
  expect(requests).toHaveLength(1);
});

test('validates email and required travel fields before sending', async ({ page }) => {
  const requests = [];
  await page.route(enquiryEndpoint, route => {
    requests.push(route.request().postDataJSON());
    return successResponse(route);
  });
  await openPlan(page);
  await fillEnquiry(page);
  await page.locator('#email').fill('not-an-email');
  await page.locator('#month').fill('');
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#form-errors')).toBeFocused();
  await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#month')).toHaveAttribute('aria-invalid', 'true');
  expect(requests).toHaveLength(0);
});

test('requires a future Saturday for an exact charter week and sends no stale month', async ({ page }) => {
  const requests = [];
  await page.route(enquiryEndpoint, route => {
    requests.push(route.request().postDataJSON());
    return successResponse(route);
  });
  await openPlan(page);
  await fillEnquiry(page);
  await page.locator('input[name="dateMode"][value="week"]').check();
  await expect(page.locator('#month')).toBeDisabled();
  const saturday = futureSaturday();
  const sunday = new Date(`${saturday}T12:00:00Z`);
  sunday.setUTCDate(sunday.getUTCDate() + 1);
  await page.locator('#startDate').fill(sunday.toISOString().slice(0, 10));
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#form-errors')).toBeFocused();
  await expect(page.locator('#startDate')).toHaveAttribute('aria-invalid', 'true');
  expect(requests).toHaveLength(0);
  await page.locator('#startDate').fill('2020-01-04');
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#startDate')).toHaveAttribute('aria-invalid', 'true');
  expect(requests).toHaveLength(0);
  await page.locator('#startDate').fill(saturday);
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#success-panel')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ dateMode: 'week', startDate: saturday });
  expect(requests[0].month ?? '').toBe('');
});

test('switching back to flexible dates excludes the old exact date', async ({ page }) => {
  let payload;
  await page.route(enquiryEndpoint, route => {
    payload = route.request().postDataJSON();
    return successResponse(route);
  });
  await openPlan(page);
  await fillEnquiry(page, { week: true });
  await page.locator('input[name="dateMode"][value="flexible"]').check();
  await expect(page.locator('#startDate')).toBeDisabled();
  await page.locator('#month').fill(futureMonth());
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#success-panel')).toBeVisible();
  expect(payload).toMatchObject({ dateMode: 'flexible', month: futureMonth() });
  expect(payload.startDate ?? '').toBe('');
});

test('matches the API future-only and three-year date limits', async ({ page }) => {
  // A Saturday makes same-day rejection observable, regardless of the real test day.
  await page.clock.install({ time: new Date('2027-01-02T12:00:00Z') });
  const requests = [];
  await page.route(enquiryEndpoint, route => {
    requests.push(route.request().postDataJSON());
    return successResponse(route);
  });
  await openPlan(page);
  await expect(page.locator('#startDate')).toHaveValue('2027-01-09');
  await fillEnquiry(page, { week: true });
  await page.locator('#startDate').fill('2027-01-02');
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#form-errors')).toBeFocused();
  await expect(page.locator('#startDate')).toHaveAttribute('aria-invalid', 'true');
  expect(requests).toHaveLength(0);
  // 5 January 2030 is a Saturday, just outside the API's inclusive 2 January limit.
  await page.locator('#startDate').fill('2030-01-05');
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#startDate')).toHaveAttribute('aria-invalid', 'true');
  expect(requests).toHaveLength(0);
  await page.locator('input[name="dateMode"][value="flexible"]').check();
  await page.locator('#month').fill('2030-02');
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#month')).toHaveAttribute('aria-invalid', 'true');
  expect(requests).toHaveLength(0);
  await page.locator('#month').fill('2030-01');
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#success-panel')).toBeVisible();
  expect(requests).toHaveLength(1);
});

test('counts one anonymous visit per session across reloads without form data', async ({ page }) => {
  const visits = [];
  await mockVisits(page, visits);
  await openPlan(page);
  await expect.poll(() => visits.length).toBe(1);
  expect(Object.keys(visits[0]).sort()).toEqual(['source', 'visitId']);
  expect(visits[0].visitId).toMatch(uuidPattern);
  expect(visits[0].source).toBe('browser-test');
  await fillEnquiry(page);
  await page.reload();
  await expect(page.locator('#enquiry-form')).toBeVisible();
  await page.reload();
  await expect(page.locator('#enquiry-form')).toBeVisible();
  expect(visits).toHaveLength(1);
});

test('failed visit recording does not block a genuine enquiry', async ({ page }) => {
  await page.route('**/v1/visits', route => route.abort('failed'));
  await page.route(enquiryEndpoint, route => successResponse(route));
  await openPlan(page);
  await fillEnquiry(page);
  await page.locator('#submit-enquiry').click();
  await expect(page.locator('#success-panel')).toBeVisible();
});

test('page fits its viewport and exposes the form through the keyboard', async ({ page }, testInfo) => {
  await openPlan(page);
  await expect(page.locator('#consent')).not.toBeChecked();
  await expect(page.locator('#success-panel')).not.toBeVisible();
  const layout = await page.evaluate(() => ({
    width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.width + 1);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.width + 1);
  if (testInfo.project.name.endsWith('mobile')) expect(layout.width).toBe(390);
  await page.locator('#email').focus();
  await expect(page.locator('#email')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toMatch(/INPUT|SELECT|TEXTAREA|A/);
  await page.screenshot({
    path: testInfo.project.name.endsWith('mobile')
      ? '/tmp/sailorspot-enquiry-mobile.png'
      : '/tmp/sailorspot-enquiry-desktop.png',
    fullPage: true,
  });
});
