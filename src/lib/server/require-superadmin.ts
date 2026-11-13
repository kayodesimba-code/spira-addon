import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSessionUser } from "./session";

/** Redirect non-superadmins away from Settings / Activity. */
export async function requireSuperadmin(fallback = "/sit-build"): Promise<void> {
  const store = await cookies();
  const user = await readSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "superadmin") redirect(fallback);
}
