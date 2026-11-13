/** Parse Supabase Auth redirects (tokens or errors in the URL hash / query). */

export type AuthLinkResult =
  | { kind: "session"; accessToken: string; type: string | null }
  | { kind: "error"; code: string | null; message: string }
  | { kind: "empty" };

export function readAuthLink(search = "", hash = ""): AuthLinkResult {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const frag = new URLSearchParams(hash.replace(/^#/, ""));
  const get = (key: string) => frag.get(key) || query.get(key);

  const accessToken = get("access_token");
  if (accessToken) {
    return { kind: "session", accessToken, type: get("type") };
  }

  const error = get("error");
  const code = get("error_code");
  const description = get("error_description");
  if (error || code || description) {
    const raw = (description || code || error || "This email link is not valid.").replace(/\+/g, " ");
    const message =
      code === "otp_expired" || /expired|invalid/i.test(raw)
        ? "This email link is invalid or has expired (email apps sometimes open it automatically). Go to Create an account and we will send a fresh link."
        : raw;
    return { kind: "error", code, message };
  }

  return { kind: "empty" };
}
