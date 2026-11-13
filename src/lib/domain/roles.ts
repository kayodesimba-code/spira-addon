/** App roles. Superadmins see Settings, Activity, and connection status in the sidebar. */

export type AppRole = "superadmin" | "member";

/** Hard-coded superadmins (email, lowercased). */
export const SUPERADMIN_EMAILS = new Set(["kayode.simba@gmail.com"]);

/** Hard-coded superadmins (Supabase user id). */
export const SUPERADMIN_IDS = new Set(["0a703eb3-2b16-480c-8566-039dd15859f2"]);

export function resolveAppRole(input: { sub?: string | null; email?: string | null }): AppRole {
  const sub = input.sub?.trim() || "";
  const email = input.email?.trim().toLowerCase() || "";
  // Legacy shared-password session.
  if (sub === "admin") return "superadmin";
  if (sub && SUPERADMIN_IDS.has(sub)) return "superadmin";
  if (email && SUPERADMIN_EMAILS.has(email)) return "superadmin";
  return "member";
}

export function isSuperadmin(role: AppRole | null | undefined): boolean {
  return role === "superadmin";
}
