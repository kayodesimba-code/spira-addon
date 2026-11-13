"use client";

import { Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      const out = await api<{ message: string }>("/api/auth/signup", {
        method: "POST",
        body: { email: email.trim() },
      });
      setSent(out.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface flex flex-col gap-4 p-6">
      {error && <Notice tone="danger">{error}</Notice>}
      {sent && <Notice tone="success">{sent}</Notice>}
      <Field label="Work email">
        {(props) => (
          <input
            {...props}
            type="email"
            autoComplete="email"
            autoFocus
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={Boolean(sent)}
          />
        )}
      </Field>
      {!sent && (
        <Button type="submit" variant="primary" busy={busy} disabled={!email.trim()} icon={Mail}>
          Send verification link
        </Button>
      )}
    </form>
  );
}
