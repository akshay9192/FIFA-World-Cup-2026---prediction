const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || response.statusText);
  return response.json();
}

export const pct = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
