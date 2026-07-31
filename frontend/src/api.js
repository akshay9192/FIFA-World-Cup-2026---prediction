const configuredBase = process.env.REACT_APP_API_BASE;
export const API_BASE = configuredBase
  ? configuredBase.replace(/\/$/, '')
  : process.env.NODE_ENV === 'test'
    ? 'http://test.invalid'
    : '';

export async function api(path, options = {}) {
  if (!API_BASE) {
    throw new Error('Backend URL is not configured. Set REACT_APP_API_BASE and try again.');
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch (error) {
    throw new Error('The replay service is unavailable. Check the backend and try again.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

export const formatPercent = (value, digits = 0) =>
  new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);

export const formatDate = (value) =>
  new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value.endsWith?.('Z') ? value : `${value}Z`));

export const stageName = (stage) =>
  ({
    group: 'Group stage',
    r32: 'Round of 32',
    r16: 'Round of 16',
    qf: 'Quarter-final',
    sf: 'Semi-final',
    third: 'Third-place play-off',
    final: 'Final',
  })[stage] || stage;
