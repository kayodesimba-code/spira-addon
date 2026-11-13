import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand";
import { AuthCallbackClient } from "./callback-client";

export const metadata: Metadata = { title: "Finishing sign-up" };

export default function AuthCallbackPage() {
  return (
    <main className="app-backdrop grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Finishing sign-up</h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-zinc-400">One moment while we open the password screen…</p>
        </div>
        <Suspense>
          <AuthCallbackClient />
        </Suspense>
      </div>
    </main>
  );
}
