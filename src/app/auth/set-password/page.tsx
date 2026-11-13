import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Create password" };

export default function SetPasswordPage() {
  return (
    <main className="app-backdrop flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-sm min-w-0 animate-fade-up">
        <div className="mb-6 flex flex-col items-center px-1 text-center sm:mb-8">
          <Logo size="lg" />
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-balance sm:mt-6 sm:text-2xl">Create your password</h1>
          <p className="mt-1.5 text-sm text-pretty text-slate-600 dark:text-zinc-400">
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
