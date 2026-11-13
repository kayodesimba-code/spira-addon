import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <main className="app-backdrop grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Create an account</h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-zinc-400">
            We email you a verification link. Open it to create your password.
          </p>
        </div>
        <SignupForm />
        <p className="mt-4 text-center text-sm text-slate-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
