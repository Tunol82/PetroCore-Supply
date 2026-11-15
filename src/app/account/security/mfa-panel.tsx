"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/client";

export type TotpFactor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
  created_at: string;
};

export type Assurance = {
  currentLevel: string | null;
  nextLevel: string | null;
};

type Enrollment = {
  id: string;
  totp: {
    qr_code: string;
    secret: string;
  };
};

const cardClass = "rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm";
const fieldClass =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10";
const buttonClass =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50";

export function MfaPanel({
  initialFactors,
  initialAssurance,
}: {
  initialFactors: TotpFactor[];
  initialAssurance: Assurance | null;
}) {
  const router = useRouter();
  const factors = initialFactors;
  const assurance = initialAssurance;
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [verifyFactorId, setVerifyFactorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function startEnrollment() {
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });

      if (enrollError || !data) {
        setError("The authenticator could not be created. Try again.");
        return;
      }

      setEnrollment({ id: data.id, totp: { qr_code: data.totp.qr_code, secret: data.totp.secret } });
      setCode("");
    } catch {
      setError("The authenticator could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(factorId: string) {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator.");
      return;
    }

    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });

      if (challengeError || !challenge) {
        setError("The verification challenge could not be started.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) {
        setError("That code was not accepted. Check the time on your device and try again.");
        return;
      }

      setEnrollment(null);
      setVerifyFactorId(null);
      setCode("");
      setNotice("Multi-factor authentication is active for this session.");
      router.refresh();
    } catch {
      setError("Verification failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(factorId: string) {
    setError(null);
    setNotice(null);
    setBusy(true);

    const isLastFactor = factors.length === 1;

    try {
      const supabase = createClient();
      const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId });

      if (removeError) {
        setError(
          "The authenticator could not be removed. Verify a code first, then try again.",
        );
        return;
      }

      if (isLastFactor) {
        // Enrolling a factor elevates the session to AAL2. Removing the last one
        // must not leave an elevated session behind, so end it.
        await supabase.auth.signOut();
        router.replace("/login");
        router.refresh();
        return;
      }

      setNotice("Authenticator removed.");
      router.refresh();
    } catch {
      setError("The authenticator could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  const isAal2 = assurance?.currentLevel === "aal2";
  const needsChallenge = assurance?.nextLevel === "aal2" && !isAal2;

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Session assurance</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Platform tenant access requires a verified second factor.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              isAal2 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
            }`}
          >
            {isAal2 ? "Verified · AAL2" : "Password only · AAL1"}
          </span>
        </div>

        {needsChallenge ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            An authenticator is enrolled. Verify a code below to raise this session to AAL2.
          </p>
        ) : null}
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Authenticator app</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Use any TOTP app (for example Google Authenticator, 1Password or Authy). Keep the secret private.
        </p>

        {factors.length > 0 ? (
          <div className="mt-4 divide-y divide-[var(--line)]">
            {factors.map((factor) => (
              <div key={factor.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{factor.friendly_name || "Authenticator"}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {factor.status === "verified" ? "Verified" : "Awaiting verification"} ·{" "}
                    {new Date(factor.created_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {factor.status !== "verified" ? (
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => {
                        setVerifyFactorId(factor.id);
                        setCode("");
                        setError(null);
                      }}
                    >
                      Verify
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() => void removeFactor(factor.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">No authenticator is enrolled.</p>
        )}

        {enrollment ? (
          <div className="mt-5 rounded-xl border border-[var(--line)] p-4">
            <p className="text-sm font-semibold">Scan this code</p>
            <div className="mt-3 flex flex-wrap items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR is a one-time data URI, not a content image */}
              <img
                src={enrollment.totp.qr_code}
                alt="Authenticator enrolment QR code"
                className="h-40 w-40 rounded-lg border border-[var(--line)] bg-white p-1"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--muted)]">Manual setup secret</p>
                <code
                  data-testid="mfa-secret"
                  className="mt-1 block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs"
                >
                  {enrollment.totp.secret}
                </code>
                <label htmlFor="mfa-code" className="mt-4 block text-xs font-medium text-[var(--muted)]">
                  6-digit code
                </label>
                <input
                  id="mfa-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className={`${fieldClass} mt-1 tracking-[0.3em]`}
                  placeholder="000000"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busy || code.length !== 6}
                    onClick={() => void verify(enrollment.id)}
                  >
                    {busy ? "Verifying…" : "Verify and enable"}
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() => {
                      setEnrollment(null);
                      setCode("");
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : verifyFactorId ? (
          <div className="mt-5 rounded-xl border border-[var(--line)] p-4">
            <label htmlFor="mfa-verify-code" className="block text-xs font-medium text-[var(--muted)]">
              Enter a code from your authenticator
            </label>
            <input
              id="mfa-verify-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={`${fieldClass} mt-1 max-w-xs tracking-[0.3em]`}
              placeholder="000000"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClass}
                disabled={busy || code.length !== 6}
                onClick={() => void verify(verifyFactorId)}
              >
                {busy ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={busy}
                onClick={() => {
                  setVerifyFactorId(null);
                  setCode("");
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={`${buttonClass} mt-4`}
            disabled={busy}
            onClick={() => void startEnrollment()}
          >
            {busy ? "Preparing…" : "Set up authenticator"}
          </button>
        )}

        {error ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {notice}
          </p>
        ) : null}
      </section>
    </div>
  );
}
