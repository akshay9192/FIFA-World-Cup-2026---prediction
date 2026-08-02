const configuredBase = process.env.REACT_APP_API_BASE;
export const API_BASE = configuredBase
  ? configuredBase.replace(/\/$/, '')
  : process.env.NODE_ENV === 'test'
    ? 'http://test.invalid'
    : '';

export const API_TIMEOUT_MS = 65000;
const cacheablePaths = new Set(['/health', '/meta', '/predictions', '/accuracy', '/teams']);
const responseCache = new Map();
const inFlight = new Map();

export async function api(path, options = {}) {
  if (!API_BASE) {
    throw new Error('Backend URL is not configured. Set REACT_APP_API_BASE and try again.');
  }
  const {
    force = false,
    timeoutMs = API_TIMEOUT_MS,
    ...requestOptions
  } = options;
  const method = (requestOptions.method || 'GET').toUpperCase();
  const cacheable = method === 'GET' && cacheablePaths.has(path);
  if (cacheable && !force && responseCache.has(path)) {
    return responseCache.get(path);
  }
  const requestKey = `${method}:${path}`;
  if (!force && inFlight.has(requestKey)) {
    return inFlight.get(requestKey);
  }
  const request = requestJson(path, requestOptions, timeoutMs)
    .then((payload) => {
      if (cacheable) responseCache.set(path, payload);
      return payload;
    })
    .finally(() => {
      inFlight.delete(requestKey);
    });
  inFlight.set(requestKey, request);
  return request;
}

async function requestJson(path, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The replay service took too long to respond. It may still be waking up—please retry.');
    }
    throw new Error('The replay service is unavailable. Check the backend and try again.');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

export function clearApiCache(paths = [...cacheablePaths]) {
  paths.forEach((path) => responseCache.delete(path));
  inFlight.clear();
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
