import { cookies } from "next/headers";
import { handler, jsonError, ok } from "@/lib/server/http";
import { SESSION_COOKIE, readSessionUser } from "@/lib/server/session";

/** Current signed-in user (email + role) for the sidebar. */
export const GET = handler(async () => {
  const store = await cookies();
  const user = await readSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return jsonError(401, "Sign in to continue.");
  return ok({
    sub: user.sub,
    email: user.email,
    role: user.role,
    superadmin: user.role === "superadmin",
  });
});
