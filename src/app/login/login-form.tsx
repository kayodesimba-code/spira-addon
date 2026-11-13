"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { readAuthLink } from "@/lib/client/auth-link";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const result = readAuthLink(window.location.search, window.location.hash);
    if (result.kind === "session") {
      const q = new URLSearchParams({ access_token: result.accessToken });
      if (result.type) q.set("type", result.type);
      window.location.replace(`/auth/set-password?${q.toString()}`);
      return;
    }
    if (result.kind === "error") {
      setError(result.message);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", body: { email: email.trim(), password } });
      window.location.assign(safeNext(params.get("next")));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface flex w-full min-w-0 flex-col gap-4 p-4 sm:p-6">
      {error && (
        <Notice tone="danger" title="Could not sign in">
          {error}
        </Notice>
      )}
      <Field label="Email">
        {(props) => (
          <input
            {...props}
            type="email"
            inputMode="email"
            autoComplete="username"
            autoFocus
            required
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Field label="Password">
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="current-password"
            required
            className="input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" variant="primary" className="w-full" busy={busy} disabled={!email.trim() || !password} icon={LogIn}>
        Sign in
      </Button>
      <p className="text-center text-sm text-pretty text-slate-600 dark:text-zinc-400">
        New here?{" "}
        <Link href="/signup" className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
          Create an account
        </Link>
      </p>
    </form>
  );
}
