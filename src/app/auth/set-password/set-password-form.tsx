"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { readAuthLink } from "@/lib/client/auth-link";

export function SetPasswordForm() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const result = readAuthLink(window.location.search, window.location.hash);
    if (result.kind === "session") {
      setAccessToken(result.accessToken);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    if (result.kind === "error") {
      setError(result.message);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    setError("Open the verification link from your email. This page needs that link to set your password.");
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
      {!accessToken && (
        <p className="text-center text-sm text-slate-600 dark:text-zinc-400">
          <Link href="/signup" className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
            Request a new link
          </Link>
        </p>
      )}
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
