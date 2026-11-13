import { z } from "zod";
import { cookies, headers } from "next/headers";
import {
  clearFailedLogins,
  loginRateLimited,
  recordFailedLogin,
  setSupabasePasswordWithToken,
  supabaseAuthConfigured,
} from "@/lib/server/auth";
import { handler, jsonError, ok, parseBody } from "@/lib/server/http";
import {
  authConfigured,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/server/session";

const schema = z.object({
  accessToken: z.string().min(20, "This link is missing a token. Open the email link again.").max(4000),
  password: z.string().min(8, "Use at least 8 characters.").max(512),
  confirm: z.string().min(1).max(512),
});

export const POST = handler(
  async (request: Request) => {
    if (!authConfigured() || !supabaseAuthConfigured()) {
      return jsonError(503, "Sign-in is not configured.");
    }
    const headerList = await headers();
    const clientKey =
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "local";
    if (loginRateLimited(clientKey)) {
      return jsonError(429, "Too many attempts. Wait 15 minutes and try again.");
    }
    const body = await parseBody(request, schema);
    if (body.password !== body.confirm) {
      return jsonError(400, "Passwords do not match.");
    }
    let user;
    try {
      user = await setSupabasePasswordWithToken(body.accessToken, body.password);
    } catch (error) {
      recordFailedLogin(clientKey);
      return jsonError(502, error instanceof Error ? error.message : "Could not set the password.");
    }
    if (!user) {
      recordFailedLogin(clientKey);
      return jsonError(401, "This link has expired or was already used. Request a new invite or sign in.");
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
