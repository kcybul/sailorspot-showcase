import { expect } from '@playwright/test';

export const enquiryEndpoint = '**/v1/enquiries';
export const visitEndpoint = '**/v1/visits';
export const testEmail = 'charter-browser-test@example.test';
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function futureMonth() {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + 3, 1);
  return date.toISOString().slice(0, 7);
}

export function futureSaturday() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 60);
  date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7));
  return date.toISOString().slice(0, 10);
}

async function setValue(locator, value) {
  if (await locator.evaluate(element => element.tagName === 'SELECT')) {
    await locator.selectOption(String(value));
  } else {
    await locator.fill(String(value));
  }
}

export async function fillEnquiry(page, { email = testEmail, week = false } = {}) {
  await page.locator('#email').fill(email);
  await page.locator('#name').fill('Browser acceptance test');
  await page.locator(`input[name="dateMode"][value="${week ? 'week' : 'flexible'}"]`).check();
  if (week) {
    await page.locator('#startDate').fill(futureSaturday());
  } else {
    await page.locator('#month').fill(futureMonth());
  }
  await setValue(page.locator('#durationWeeks'), 1);
  await setValue(page.locator('#guests'), 6);
  await setValue(page.locator('#skipper'), 'needed');
  await setValue(page.locator('#budget'), '5000-8000');
  await page.locator('#notes').fill('Planning a one-week sailing holiday with six adults.');
  await page.locator('#consent').check();
}

export async function mockVisits(page, visits = []) {
  await page.route(visitEndpoint, async route => {
    visits.push(route.request().postDataJSON());
    await route.fulfill({ status: 204, body: '' });
  });
}

export async function openPlan(page) {
  await page.goto('/plan/?source=browser-test&utm_source=browser-test');
  await expect(page.locator('#enquiry-form')).toBeVisible();
}

export async function assertRetainedEnquiry(page) {
  await expect(page.locator('#email')).toHaveValue(testEmail);
  await expect(page.locator('#name')).toHaveValue('Browser acceptance test');
  await expect(page.locator('#notes')).toHaveValue('Planning a one-week sailing holiday with six adults.');
  await expect(page.locator('#consent')).toBeChecked();
  await expect(page.locator('#submit-enquiry')).toBeEnabled();
  await expect(page.locator('#success-panel')).not.toBeVisible();
}

export async function successResponse(route, status = 201, reference = 'SS-TEST-12345678') {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ reference, receivedAt: new Date().toISOString() }),
  });
}

export async function overrideApiEndpoint(page, apiBase) {
  const endpoint = new URL('/v1/enquiries', apiBase).toString();
  await page.route('**/plan/**', async route => {
    if (!route.request().isNavigationRequest()) return route.continue();
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(/(<meta\s+name="enquiry-api"\s+content=")[^"]+("\s*\/?>)/, `$1${endpoint}$2`);
    expect(body, 'The live test must replace the API meta tag before the app reads it').not.toBe(original);
    await route.fulfill({ response, body });
  });
}
