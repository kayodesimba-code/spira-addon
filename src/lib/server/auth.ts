import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "./session";

export function passwordMatches(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function supabaseAuthConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

function supabaseServiceKey(): string | null {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim() || null;
}

export const supabaseAuthConfigured = (): boolean => supabaseAuthConfig() !== null;

export const supabaseInviteConfigured = (): boolean => supabaseAuthConfig() !== null && Boolean(supabaseServiceKey());

async function authFetch(
  path: string,
  init: { method?: string; body?: unknown; apiKey: string; bearer?: string },
): Promise<Response> {
  const c = supabaseAuthConfig();
  if (!c) throw new Error("Supabase Auth is not configured.");
  return fetch(`${c.url}/auth/v1/${path}`, {
    method: init.method ?? "GET",
    headers: {
      apikey: init.apiKey,
      Authorization: `Bearer ${init.bearer ?? init.apiKey}`,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
}

/**
 * Verify email/password with Supabase Auth (password grant). Server-only; the browser never talks to Supabase.
 * Returns a session user on success, or null when credentials are wrong. Throws on misconfiguration / upstream errors.
 */
export async function verifySupabasePassword(email: string, password: string): Promise<SessionUser | null> {
  const c = supabaseAuthConfig();
  if (!c) throw new Error("Supabase Auth is not configured.");
  const response = await authFetch("token?grant_type=password", {
    method: "POST",
    apiKey: c.anonKey,
    body: { email: email.trim(), password },
  });
  if (response.status === 400 || response.status === 401) return null;
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase Auth refused sign-in (HTTP ${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const raw = (await response.json()) as { user?: { id?: string; email?: string | null } };
  const id = raw.user?.id?.trim();
  if (!id) return null;
  return { sub: id, email: raw.user?.email?.trim() || email.trim(), role: "admin" };
}

/** Send a Supabase invite email. The user opens the link and sets their password on /auth/set-password. */
export async function inviteSupabaseUser(email: string, redirectTo: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const c = supabaseAuthConfig();
  const serviceKey = supabaseServiceKey();
  if (!c || !serviceKey) throw new Error("Supabase invite is not configured (need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).");
  const response = await authFetch("invite", {
    method: "POST",
    apiKey: serviceKey,
    bearer: serviceKey,
    body: { email: email.trim().toLowerCase(), redirect_to: redirectTo },
  });
  if (response.ok) return { ok: true };
  const detail = await response.text().catch(() => "");
  if (response.status === 422 || /already|registered|exists/i.test(detail)) {
    return { ok: false, reason: "exists" };
  }
  throw new Error(`Supabase could not send the invite (HTTP ${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
}

/** Password-recovery email that lands on redirectTo so the user can create / reset their password. */
export async function sendPasswordSetupEmail(email: string, redirectTo: string): Promise<void> {
  const c = supabaseAuthConfig();
  if (!c) throw new Error("Supabase Auth is not configured.");
  const response = await authFetch("recover", {
    method: "POST",
    apiKey: c.anonKey,
    body: { email: email.trim().toLowerCase(), redirect_to: redirectTo },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase could not send the password link (HTTP ${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
}

/** Set password using the access token from the invite / recovery email link, then return the user. */
export async function setSupabasePasswordWithToken(accessToken: string, password: string): Promise<SessionUser | null> {
  const c = supabaseAuthConfig();
  if (!c) throw new Error("Supabase Auth is not configured.");
  const response = await authFetch("user", {
    method: "PUT",
    apiKey: c.anonKey,
    bearer: accessToken,
    body: { password },
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase could not set the password (HTTP ${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const raw = (await response.json()) as { id?: string; email?: string | null };
  const id = raw.id?.trim();
  if (!id) return null;
  return { sub: id, email: raw.email?.trim() || null, role: "admin" };
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function loginRateLimited(clientKey: string, now = Date.now()): boolean {
  const entry = attempts.get(clientKey);
  if (!entry || entry.resetAt < now) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedLogin(clientKey: string, now = Date.now()): void {
  const entry = attempts.get(clientKey);
  if (!entry || entry.resetAt < now) attempts.set(clientKey, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}

export function clearFailedLogins(clientKey: string): void {
  attempts.delete(clientKey);
}

export async function hasSession(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
