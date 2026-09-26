// A deliberately tiny API client - no extra HTTP library needed. Every
// call attaches the JWT (if we have one) as a Bearer token, and throws
// a plain Error with the server's message on non-2xx responses so page
// components can just try/catch and show err.message.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('dhaka_pool_token');
}

function getUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('dhaka_pool_user');
  return raw ? JSON.parse(raw) : null;
}

function saveSession(token, user) {
  localStorage.setItem('dhaka_pool_token', token);
  localStorage.setItem('dhaka_pool_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('dhaka_pool_token');
  localStorage.removeItem('dhaka_pool_user');
}

async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export { api, getToken, getUser, saveSession, clearSession, API_BASE };
