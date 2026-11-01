// Pure form helpers are shared with acceptance checks. UTC calendar boundaries
// match the API, including its future-date and three-year planning window.
export function utcDateString(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function latestPlanningDate(now = new Date()) {
  const year = now.getUTCFullYear() + 3;
  const month = now.getUTCMonth();
  const finalDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return utcDateString(new Date(Date.UTC(year, month, Math.min(now.getUTCDate(), finalDay))));
}

export function defaultPlanningMonth(now = new Date()) {
  // June in the next summer season; always a current or future month.
  const year = now.getUTCFullYear() + (now.getUTCMonth() > 5 ? 1 : 0);
  return `${year}-06`;
}

export function nextSaturday(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7 || 7));
  return utcDateString(date);
}

export function sourceFromSearch(search = '') {
  const source = new URLSearchParams(search).get('utm_source') || '';
  return /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(source) ? source.toLowerCase() : 'direct';
}

export function enquiryFromForm(data, source = 'direct') {
  const text = key => String(data.get(key) ?? '').trim();
  const dateMode = text('dateMode');
  const name = text('name');
  return {
    email: text('email'),
    ...(name ? { name } : {}),
    destination: 'Croatia',
    dateMode,
    ...(dateMode === 'week' ? { startDate: text('startDate') } : { month: text('month') }),
    durationWeeks: Number(text('durationWeeks')),
    guests: Number(text('guests')),
    skipper: text('skipper'),
    budget: text('budget'),
    notes: text('notes'),
    source,
    consent: data.get('consent') === 'on',
    website: text('website'),
  };
}

export function validateEnquiry(data, now = new Date()) {
  const errors = {};
  const today = utcDateString(now);
  const latest = latestPlanningDate(now);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254) {
    errors.email = 'Enter an email address where Karol can reach you.';
  }
  if (data.name && data.name.length > 100) errors.name = 'Keep your name to 100 characters or fewer.';
  if (data.dateMode === 'week') {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(data.startDate) ? new Date(`${data.startDate}T12:00:00Z`) : null;
    if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== data.startDate) {
      errors.startDate = 'Choose the Saturday you would like to start.';
    } else if (data.startDate <= today || data.startDate > latest) {
      errors.startDate = 'Choose a future starting Saturday within the next three years.';
    } else if (parsed.getUTCDay() !== 6) {
      errors.startDate = 'Charter weeks begin on Saturday. Choose a Saturday, or use flexible dates.';
    }
  } else if (data.dateMode === 'flexible') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(data.month) || data.month < today.slice(0, 7) || data.month > latest.slice(0, 7)) {
      errors.month = 'Choose this month or a future month within the next three years.';
    }
  } else {
    errors.month = 'Choose a month or a starting Saturday.';
  }
  if (!Number.isInteger(data.durationWeeks) || data.durationWeeks < 1 || data.durationWeeks > 4) errors.durationWeeks = 'Choose a trip of one to four weeks.';
  if (!Number.isInteger(data.guests) || data.guests < 1 || data.guests > 12) errors.guests = 'Choose the number of people in your group, from 1 to 12.';
  if (!['self', 'needed', 'unsure'].includes(data.skipper)) errors.skipper = 'Choose whether you need a skipper, or select “I’m not sure yet”.';
  if (!['under-3000', '3000-5000', '5000-8000', '8000-plus', 'unsure'].includes(data.budget)) errors.budget = 'Choose a rough budget, or select “I’m not sure yet”.';
  if (data.notes.length > 1500) errors.notes = 'Keep your note to 1,500 characters or fewer.';
  if (data.consent !== true) errors.consent = 'Please agree to the use of your details so Karol can respond.';
  return errors;
}
