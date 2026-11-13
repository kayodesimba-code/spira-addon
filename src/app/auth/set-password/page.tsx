import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Create password" };

export default function SetPasswordPage() {
  return (
    <main className="app-backdrop grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Create your password</h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-zinc-400">
            Confirm it below. This becomes the password you use to sign in.
          </p>
        </div>
        <Suspense>
          <SetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
