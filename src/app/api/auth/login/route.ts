import { z } from "zod";
import { cookies, headers } from "next/headers";
import {
  clearFailedLogins,
  loginRateLimited,
  passwordMatches,
  recordFailedLogin,
  supabaseAuthConfigured,
  verifySupabasePassword,
} from "@/lib/server/auth";
import { handler, jsonError, ok, parseBody } from "@/lib/server/http";
import {
  authConfigured,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionUserFromIdentity,
  type SessionUser,
} from "@/lib/server/session";

const schema = z.object({
  email: z.string().max(320).optional(),
  password: z.string().min(1, "Enter the password.").max(512),
});

export const POST = handler(
  async (request: Request) => {
    if (!authConfigured()) {
      return jsonError(
        503,
        "Sign-in is not configured. Set SESSION_SECRET (16+ characters) and either Supabase Auth (SUPABASE_URL + SUPABASE_ANON_KEY) or APP_PASSWORD.",
      );
    }
    const headerList = await headers();
    const clientKey =
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "local";
    if (loginRateLimited(clientKey)) {
      return jsonError(429, "Too many attempts. Wait 15 minutes and try again.");
    }
    const body = await parseBody(request, schema);
    const email = body.email?.trim() || "";
    const password = body.password;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError(400, "Enter a valid email.");
    }

    let user: SessionUser | null = null;
    try {
      if (email && supabaseAuthConfigured()) {
        user = await verifySupabasePassword(email, password);
      } else if (!email && process.env.APP_PASSWORD && passwordMatches(password)) {
        // Legacy team password / smoke scripts (no email).
        user = sessionUserFromIdentity("admin", null);
      } else if (email && !supabaseAuthConfigured() && process.env.APP_PASSWORD && passwordMatches(password)) {
        user = sessionUserFromIdentity("admin", email);
      }
    } catch (error) {
      recordFailedLogin(clientKey);
      return jsonError(502, error instanceof Error ? error.message : "Sign-in could not reach Supabase Auth.");
    }

    if (!user) {
      recordFailedLogin(clientKey);
      return jsonError(401, email ? "That email or password is not correct." : "That password is not correct.");
    }

    clearFailedLogins(clientKey);
    const store = await cookies();
    store.set(SESSION_COOKIE, await createSessionToken(user), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return ok({ ok: true, email: user.email });
  },
  { public: true },
);
