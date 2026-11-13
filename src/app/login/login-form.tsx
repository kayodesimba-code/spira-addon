"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";

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
    <form onSubmit={submit} className="surface flex flex-col gap-4 p-6">
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Email">
        {(props) => (
          <input
            {...props}
            type="email"
            autoComplete="username"
            autoFocus
            required
            className="input"
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
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" variant="primary" busy={busy} disabled={!email.trim() || !password} icon={LogIn}>
        Sign in
      </Button>
      <p className="text-center text-sm text-slate-600 dark:text-zinc-400">
        New here?{" "}
        <Link href="/signup" className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
          Create an account
        </Link>
      </p>
    </form>
  );
}
