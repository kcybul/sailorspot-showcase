import { utcDateString, latestPlanningDate, defaultPlanningMonth, nextSaturday, sourceFromSearch, enquiryFromForm, validateEnquiry } from './form-model.mjs';

const form = document.querySelector('#enquiry-form');
const submitButton = document.querySelector('#submit-enquiry');
const submitLabel = submitButton.querySelector('span');
const errorSummary = document.querySelector('#form-errors');
const status = document.querySelector('#submission-status');
const source = sourceFromSearch(window.location.search);
const attemptStorageKey = 'sailorspot:enquiry-attempt:v1';
const visitStorageKey = 'sailorspot:visit:v1';
let pending = false;
let attempt = readSession(attemptStorageKey);

function readSession(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
}

function writeSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* In-memory retries still work when session storage is unavailable. */ }
}

function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function fingerprint(data) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function setDateMode() {
  const flexible = form.elements.dateMode.value === 'flexible';
  document.querySelector('#month-field').hidden = !flexible;
  document.querySelector('#startDate-field').hidden = flexible;
  form.elements.month.disabled = !flexible;
  form.elements.startDate.disabled = flexible;
}

const now = new Date();
const today = utcDateString(now);
const tomorrow = new Date(now);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
form.elements.month.min = today.slice(0, 7);
form.elements.month.max = latestPlanningDate(now).slice(0, 7);
form.elements.month.value = defaultPlanningMonth();
form.elements.startDate.min = utcDateString(tomorrow);
form.elements.startDate.max = latestPlanningDate(now);
form.elements.startDate.value = nextSaturday();
form.querySelectorAll('[name="dateMode"]').forEach(input => input.addEventListener('change', setDateMode));
setDateMode();
form.elements.notes.addEventListener('input', () => {
  document.querySelector('#notes-count').textContent = `${form.elements.notes.value.length.toLocaleString('en-GB')} / 1,500`;
});

function clearErrors() {
  errorSummary.hidden = true;
  errorSummary.querySelector('ul').replaceChildren();
  form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field-error').forEach(element => { element.hidden = true; element.textContent = ''; });
}

function showErrors(errors) {
  clearErrors();
  const list = errorSummary.querySelector('ul');
  for (const [name, message] of Object.entries(errors)) {
    const field = document.getElementById(name);
    const detail = document.getElementById(`${name}-error`);
    if (!field || !detail) continue;
    field.setAttribute('aria-invalid', 'true');
    detail.textContent = message;
    detail.hidden = false;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${name}`;
    link.textContent = message;
    link.addEventListener('click', event => { event.preventDefault(); field.focus(); });
    item.append(link);
    list.append(item);
  }
  errorSummary.hidden = false;
  errorSummary.focus();
}

function showStatus(title, message, { sending = false, focus = true } = {}) {
  status.classList.toggle('is-sending', sending);
  status.querySelector('h3').textContent = title;
  status.querySelector('p').textContent = message;
  status.querySelector('a').hidden = sending;
  status.hidden = false;
  if (focus) status.focus();
}

function setPending(value) {
  pending = value;
  submitButton.disabled = value;
  submitLabel.textContent = value ? 'Sending your enquiry…' : 'Send my charter enquiry';
  form.setAttribute('aria-busy', String(value));
  // Keep the exact submitted data intact while a request is in flight.
  form.querySelectorAll('fieldset').forEach(fieldset => { fieldset.disabled = value; });
}

function showSuccess(receipt) {
  clearErrors();
  status.hidden = true;
  form.hidden = true;
  const panel = document.querySelector('#success-panel');
  document.querySelector('#enquiry-reference').textContent = receipt.reference;
  document.querySelector('#received-at').textContent = `Received ${new Date(receipt.receivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  panel.hidden = false;
  panel.focus();
}

let api;
try {
  api = new URL(document.querySelector('meta[name="enquiry-api"]').content, window.location.href);
  if (!['https:', 'http:'].includes(api.protocol)) throw new Error('Unsupported endpoint');
  if (api.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)) throw new Error('HTTPS required');
  if (!crypto?.subtle || !crypto?.getRandomValues) throw new Error('Secure browser context required');
  submitButton.disabled = false;
} catch {
  api = null;
  showStatus('The form is temporarily unavailable', 'Please contact Karol directly at captain@sailorspot.ch to share your plans.', { focus: false });
}

// A single anonymous visit attempt per tab session. This never blocks the form
// and never includes a page URL, referrer, email, or browser fingerprint.
if (api && !readSession(visitStorageKey)) {
  const visit = { visitId: newId(), source };
  writeSession(visitStorageKey, visit);
  const visitsApi = new URL('/v1/visits', api);
  fetch(visitsApi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(visit), credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true }).catch(() => {});
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending || !api) return;
  status.hidden = true;
  clearErrors();
  const data = enquiryFromForm(new FormData(form), source);
  const errors = validateEnquiry(data);
  if (Object.keys(errors).length) { showErrors(errors); return; }

  setPending(true);
  showStatus('Sending your enquiry', 'Please keep this page open while we save your details.', { sending: true, focus: false });
  let timer;
  try {
    const hash = await fingerprint(data);
    const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!attempt || attempt.fingerprint !== hash || !validId.test(attempt.requestId)) {
      attempt = { requestId: newId(), fingerprint: hash };
      // Only a one-way payload hash and request ID are stored; no contact data.
      writeSession(attemptStorageKey, attempt);
    }
    const controller = new AbortController();
    timer = window.setTimeout(() => controller.abort(), 15000);
    const response = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: attempt.requestId, ...data }),
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    const result = await response.json().catch(() => null);
    if ([200, 201].includes(response.status) && result && typeof result.reference === 'string' && result.reference.trim() && result.reference.length <= 100 && typeof result.receivedAt === 'string' && Number.isFinite(new Date(result.receivedAt).getTime())) {
      showSuccess(result);
    } else if (response.status === 409) {
      attempt = null;
      writeSession(attemptStorageKey, null);
      showStatus('Please send your enquiry again', 'This attempt could not be matched to your details. They are still here. Sending again will use a new request reference.');
    } else if ([400, 422].includes(response.status)) {
      showStatus('Please check your details', 'The server could not accept this enquiry. Check your dates and email address, then try again. Your details are still here, and your enquiry has not been confirmed.');
    } else if (response.status === 429) {
      showStatus('Please try again a little later', 'Too many requests have reached the service. Your details are still here. Wait a little, then send your enquiry again.');
    } else {
      showStatus('We could not confirm your enquiry', 'The service has not returned a confirmation. Your details are still here. Please try again; retrying the same details will not create a duplicate enquiry.');
    }
  } catch {
    showStatus('We could not confirm your enquiry', 'Your connection may have been interrupted. Your details are still here. Please try again; retrying the same details will not create a duplicate enquiry.');
  } finally {
    window.clearTimeout(timer);
    setPending(false);
    setDateMode();
  }
});
