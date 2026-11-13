"use client";

import { KeyRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";

/** Read the access_token Supabase puts in the URL hash after the invite / recovery link. */
function tokenFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get("access_token") || query.get("access_token");
}

export function SetPasswordForm() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = tokenFromLocation();
    setAccessToken(token);
    if (!token) {
      setError("Open the verification link from your email. This page needs that link to set your password.");
    }
    // Drop secrets from the address bar after we read them.
    if (token && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/set-password", {
        method: "POST",
        body: { accessToken, password, confirm },
      });
      window.location.assign("/");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface flex flex-col gap-4 p-6">
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Password">
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            minLength={8}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!accessToken}
          />
        )}
      </Field>
      <Field label="Confirm password">
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={!accessToken}
          />
        )}
      </Field>
      <Button
        type="submit"
        variant="primary"
        busy={busy}
        disabled={!accessToken || password.length < 8 || password !== confirm}
        icon={KeyRound}
      >
        Save password and continue
      </Button>
    </form>
  );
}
