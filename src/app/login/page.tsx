import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-sm lg:grid-cols-2">
        <section className="flex flex-col justify-between bg-[var(--brand)] p-8 text-white sm:p-12">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">P</div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Petroleum operations platform</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">Every movement. Accounted for.</h1>
            <p className="mt-4 max-w-sm text-sm leading-7 text-white/75">
              Manage procurement, customer orders, dispatch, delivery evidence and operational performance in one connected workspace.
            </p>
          </div>
          <p className="mt-12 text-xs text-white/55">PetroCore Supply · Secure workspace access</p>
        </section>

        <section className="p-8 sm:p-12">
          <div className="max-w-sm">
            <p className="text-sm font-semibold text-[var(--brand)]">Welcome back</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to your account</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Use the email address and password associated with your PetroCore Supply account.
            </p>
            <div className="mt-8">
              <SignInForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
