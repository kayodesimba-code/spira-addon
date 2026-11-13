import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <main className="app-backdrop flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-sm min-w-0 animate-fade-up">
        <div className="mb-6 flex flex-col items-center px-1 text-center sm:mb-8">
          <Logo size="lg" />
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-balance sm:mt-6 sm:text-2xl">Create an account</h1>
          <p className="mt-1.5 text-sm text-pretty text-slate-600 dark:text-zinc-400">
            We email you a verification link. Open it to create your password.
          </p>
        </div>
        <SignupForm />
        <p className="mt-4 px-1 text-center text-sm text-pretty text-slate-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
