// Simple in-memory auth store with localStorage backup so refresh survives.
// On any 401 we clear the token and notify subscribers so the app re-renders
// the login screen.

export const API_BASE = "http://localhost:5000";

const TOKEN_KEY = "tlp_auth_token";
const USER_KEY = "tlp_auth_user";

let token: string | null = null;
let username: string | null = null;
const listeners = new Set<() => void>();

function loadFromStorage() {
  if (typeof window === "undefined") return;
  token = window.localStorage.getItem(TOKEN_KEY);
  username = window.localStorage.getItem(USER_KEY);
}
loadFromStorage();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getToken(): string | null { return token; }
export function getUsername(): string | null { return username; }
export function isAuthenticated(): boolean { return !!token; }

export function setSession(t: string, u: string) {
  token = t;
  username = u;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_KEY, t);
    window.localStorage.setItem(USER_KEY, u);
  }
  emit();
}

export function clearSession() {
  token = null;
  username = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  }
  emit();
}

export async function login(u: string, p: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });
    if (!res.ok) {
      return { ok: false, error: res.status === 401 ? "Invalid username or password" : `Login failed (${res.status})` };
    }
    const json = await res.json();
    if (!json?.token) return { ok: false, error: "Malformed response from server" };
    setSession(json.token, json.username ?? u);
    return { ok: true };
  } catch {
    return { ok: false, error: "Cannot reach API server (localhost:5000)" };
  }
}

export async function logout(): Promise<void> {
  const t = token;
  clearSession();
  if (!t) return;
  try {
    await fetch(`${API_BASE}/api/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    });
  } catch { /* ignore */ }
}

// fetch wrapper that attaches the Authorization header and clears the session
// (triggering a redirect back to login) on any 401.
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) clearSession();
  return res;
}
