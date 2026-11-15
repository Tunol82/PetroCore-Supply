"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/client";
import { signInSchema } from "@/modules/auth/validation";

type FieldErrors = {
  email?: string;
  password?: string;
};

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateEmail(value: string) {
    setEmail(value);
    if (fieldErrors.email) {
      setFieldErrors((current) => ({ ...current, email: undefined }));
    }
  }

  function updatePassword(value: string) {
    setPassword(value);
    if (fieldErrors.password) {
      setFieldErrors((current) => ({ ...current, password: undefined }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const validation = signInSchema.safeParse({ email, password });

    if (!validation.success) {
      const nextErrors: FieldErrors = {};

      for (const issue of validation.error.issues) {
        const field = issue.path[0];

        if ((field === "email" || field === "password") && !nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      }

      setFieldErrors(nextErrors);
      setIsSubmitting(false);

      const firstInvalidField = nextErrors.email ? "email" : nextErrors.password ? "password" : null;

      if (firstInvalidField) {
        document.getElementById(firstInvalidField)?.focus();
      }

      return;
    }

    setFieldErrors({});

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword(validation.data);

      if (signInError) {
        setError("We could not sign you in with those details. Check your email and password, then try again.");
        return;
      }

      router.replace("/workspace");
      router.refresh();
    } catch {
      setError("Sign-in is not available yet. The application administrator needs to complete the secure connection setup.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => updateEmail(event.target.value)}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10 aria-[invalid=true]:border-red-300"
          placeholder="you@company.com"
        />
        {fieldErrors.email ? (
          <p id="email-error" className="mt-2 text-sm text-red-700">{fieldErrors.email}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => updatePassword(event.target.value)}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10 aria-[invalid=true]:border-red-300"
          placeholder="Enter your password"
        />
        {fieldErrors.password ? (
          <p id="password-error" className="mt-2 text-sm text-red-700">{fieldErrors.password}</p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting || !email.trim() || !password}
        className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs leading-5 text-[var(--muted)]">
        Access is provided by your company administrator. Public account registration is not enabled.
      </p>
    </form>
  );
}
