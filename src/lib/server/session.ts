import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "srs_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MIN_SECRET_LENGTH = 16;

export type SessionUser = {
  /** Supabase user id, or "admin" for the legacy team-password fallback. */
  sub: string;
  email: string | null;
  role: "admin";
};

function secretKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return new TextEncoder().encode(secret);
}

/** Sign-in works when SESSION_SECRET is set and either Supabase Auth or the team password is configured. */
export function authConfigured(): boolean {
  if (secretKey() === null) return false;
  const supabase =
    Boolean(process.env.SUPABASE_URL?.trim()) &&
    Boolean(process.env.SUPABASE_ANON_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  return supabase || Boolean(process.env.APP_PASSWORD);
}

export async function createSessionToken(user: SessionUser = { sub: "admin", email: null, role: "admin" }): Promise<string> {
  const key = secretKey();
  if (!key) throw new Error("SESSION_SECRET is not configured.");
  const jwt = new SignJWT({ role: user.role, ...(user.email ? { email: user.email } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`);
  return jwt.sign(key);
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  return (await readSessionUser(token)) !== null;
}

export async function readSessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  const key = secretKey();
  if (!key || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
    if (!sub) return null;
    const email = typeof payload.email === "string" ? payload.email : null;
    return { sub, email, role: "admin" };
  } catch {
    return null;
  }
}
