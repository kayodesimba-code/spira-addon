import { z } from "zod";
import { headers } from "next/headers";
import {
  clearFailedLogins,
  inviteSupabaseUser,
  loginRateLimited,
  recordFailedLogin,
  sendPasswordSetupEmail,
  supabaseInviteConfigured,
} from "@/lib/server/auth";
import { handler, jsonError, ok, parseBody } from "@/lib/server/http";
import { authConfigured } from "@/lib/server/session";

const schema = z.object({
  email: z.string().email("Enter a valid email.").max(320),
});

function appOrigin(headerList: Headers, requestUrl: string): string {
  const forwarded = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? (requestUrl.startsWith("https") ? "https" : "http");
  if (forwarded) return `${proto}://${forwarded.split(",")[0]!.trim()}`;
  return new URL(requestUrl).origin;
}

export const POST = handler(
  async (request: Request) => {
    if (!authConfigured() || !supabaseInviteConfigured()) {
      return jsonError(
        503,
        "Account creation is not configured. Set SESSION_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    const headerList = await headers();
    const clientKey =
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "local";
    if (loginRateLimited(clientKey)) {
      return jsonError(429, "Too many attempts. Wait 15 minutes and try again.");
    }
    const { email } = await parseBody(request, schema);
    // Land on set-password after Supabase verifies the email link.
    const redirectTo = `${appOrigin(headerList, request.url)}/auth/set-password`;
    try {
      const result = await inviteSupabaseUser(email, redirectTo);
      if (!result.ok && result.reason === "exists") {
        // Incomplete / expired invites: send a fresh password-setup (recovery) link to the same screen.
        await sendPasswordSetupEmail(email, redirectTo);
      } else if (!result.ok) {
        recordFailedLogin(clientKey);
        return jsonError(409, result.reason);
      }
    } catch (error) {
      recordFailedLogin(clientKey);
      const message = error instanceof Error ? error.message : "Could not send the verification email.";
      const rateLimited = /too many emails|rate limit/i.test(message);
      return jsonError(rateLimited ? 429 : 502, message);
    }
    clearFailedLogins(clientKey);
    return ok({
      ok: true,
      message:
        "Check your email for the link. Open it once (don’t preview it in Gmail) — you’ll land on Create password. If the old link expired, submit this form again for a fresh one.",
    });
  },
  { public: true },
);
