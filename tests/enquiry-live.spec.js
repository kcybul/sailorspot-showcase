import { test, expect } from '@playwright/test';
import { fillEnquiry, openPlan, overrideApiEndpoint } from './helpers.js';

const apiBase = process.env.ENQUIRY_LIVE_API_BASE;

test('persists an enquiry through a real API and displays its returned reference', async ({ page, baseURL }, testInfo) => {
  test.skip(!apiBase, 'Set ENQUIRY_LIVE_API_BASE to an isolated local API with test persistence.');
  const apiUrl = new URL(apiBase);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname)
      && process.env.ENQUIRY_ALLOW_REMOTE_TEST_API !== '1') {
    throw new Error('Live tests default to a local API. A remote test API requires ENQUIRY_ALLOW_REMOTE_TEST_API=1.');
  }
  if (['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname)) {
    // Recent Chromium versions ask permission for cross-port loopback requests.
    // Grant it only to this isolated browser context and the test page's origin.
    await page.context().grantPermissions(['local-network-access'], { origin: new URL(baseURL).origin });
  }
  await overrideApiEndpoint(page, apiBase);
  await openPlan(page);
  const email = `browser-${testInfo.project.name}-${Date.now()}@example.test`;
  await fillEnquiry(page, { email });
  const responsePromise = page.waitForResponse(response =>
    response.url() === new URL('/v1/enquiries', apiBase).toString()
    && response.request().method() === 'POST');
  await page.locator('#submit-enquiry').click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.reference).toEqual(expect.any(String));
  expect(body.reference.trim()).not.toBe('');
  expect(body.receivedAt).toEqual(expect.any(String));
  await expect(page.locator('#success-panel')).toBeVisible();
  await expect(page.locator('#enquiry-reference')).toHaveText(body.reference);
  await testInfo.attach('persisted-enquiry-reference', {
    body: JSON.stringify({ email, reference: body.reference, receivedAt: body.receivedAt }),
    contentType: 'application/json',
  });
});
