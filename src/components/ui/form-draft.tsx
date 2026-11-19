"use client";

import { useEffect, useRef, useState } from "react";

type StoredDraft = { values: Record<string, string | boolean>; savedAt: number };

const PREFIX = "petrocore:draft:";
const MAX_AGE_MS = 7 * 86_400_000;

function draftKey(storageKey: string) {
  return `${PREFIX}${storageKey}`;
}

function collect(form: HTMLFormElement) {
  const values: Record<string, string | boolean> = {};

  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) {
      continue;
    }

    if (!element.name || element.dataset.noDraft === "true") {
      continue;
    }

    if (element instanceof HTMLInputElement) {
      if (element.type === "file" || element.type === "submit" || element.type === "button") {
        continue;
      }

      if (element.type === "checkbox" || element.type === "radio") {
        if (element.checked) {
          values[element.name] = element.value;
        }
        continue;
      }
    }

    values[element.name] = element.value;
  }

  return values;
}

function restore(form: HTMLFormElement, values: Record<string, string | boolean>) {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) {
      continue;
    }

    if (!element.name || !(element.name in values)) {
      continue;
    }

    const value = values[element.name];

    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      element.checked = String(value) === element.value;
    } else {
      element.value = String(value);
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

/**
 * Saves a form's values to local storage while the user types and restores them
 * after a reload or navigation. Clears on a successful server action.
 *
 * File inputs are skipped. Drop it inside a form.
 */
export function FormDraft({
  storageKey,
  state,
}: {
  storageKey: string;
  state: { success: string | null };
}) {
  const marker = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const [status, setStatus] = useState<"idle" | "restored" | "saved">("idle");

  useEffect(() => {
    const form = marker.current?.closest("form");

    if (!form) {
      return;
    }

    const stored = window.localStorage.getItem(draftKey(storageKey));

    if (stored) {
      try {
        const draft = JSON.parse(stored) as StoredDraft;

        if (Date.now() - draft.savedAt < MAX_AGE_MS && draft.values) {
          restore(form, draft.values);
          window.setTimeout(() => setStatus("restored"), 0);
        } else {
          window.localStorage.removeItem(draftKey(storageKey));
        }
      } catch {
        window.localStorage.removeItem(draftKey(storageKey));
      }
    }

    const scheduleSave = () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
      }

      timer.current = window.setTimeout(() => {
        const values = collect(form);

        if (Object.values(values).every((value) => value === "" || value === false)) {
          window.localStorage.removeItem(draftKey(storageKey));
          setStatus("idle");
          return;
        }

        window.localStorage.setItem(draftKey(storageKey), JSON.stringify({ values, savedAt: Date.now() } satisfies StoredDraft));
        setStatus("saved");
      }, 500);
    };

    form.addEventListener("input", scheduleSave);
    form.addEventListener("change", scheduleSave);

    return () => {
      form.removeEventListener("input", scheduleSave);
      form.removeEventListener("change", scheduleSave);

      if (timer.current) {
        window.clearTimeout(timer.current);
      }
    };
  }, [storageKey]);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    window.localStorage.removeItem(draftKey(storageKey));
  }, [state.success, storageKey]);

  if (status === "idle" || state.success) {
    return <span ref={marker} className="hidden" aria-hidden="true" />;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
      <span aria-hidden="true" className="hidden" ref={marker} />
      <span>{status === "restored" ? "Draft restored from your last visit." : "Draft saved automatically."}</span>
      <button
        type="button"
        className="font-semibold text-[var(--brand)] hover:underline"
        onClick={() => {
          const form = marker.current?.closest("form");
          window.localStorage.removeItem(draftKey(storageKey));
          form?.reset();
          setStatus("idle");
        }}
      >
        Discard draft
      </button>
    </div>
  );
}
