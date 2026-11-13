"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Notice, Spinner } from "@/components/ui";
import { readAuthLink } from "@/lib/client/auth-link";

export function AuthCallbackClient() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const result = readAuthLink(window.location.search, window.location.hash);
    if (result.kind === "session") {
      const params = new URLSearchParams();
      params.set("access_token", result.accessToken);
      if (result.type) params.set("type", result.type);
      window.location.replace(`/auth/set-password?${params.toString()}`);
      return;
    }
    if (result.kind === "error") {
      setError(result.message);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    setError("Open the verification link from your email to create your password.");
  }, []);

  if (error) {
    return (
      <div className="surface flex flex-col gap-4 p-6">
        <Notice tone="danger">{error}</Notice>
        <p className="text-center text-sm text-slate-600 dark:text-zinc-400">
          <Link href="/signup" className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
            Create an account / resend link
          </Link>
          {" · "}
          <Link href="/login" className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="surface flex items-center justify-center gap-3 p-6 text-sm text-slate-600 dark:text-zinc-400">
      <Spinner className="size-5" />
      Redirecting…
    </div>
  );
}
