"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Warns before a full page unload while a form has unsaved input.
 *
 * In-app navigation in the App Router cannot be blocked without intercepting
 * every link; this covers tab close, refresh and navigation away from the app.
 * Drop it anywhere inside a form.
 */
export function UnsavedGuard({ message = "You have unsaved changes. Leave this page?" }: { message?: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = marker.current?.closest("form");

    if (!form) {
      return;
    }

    const onInput = () => setDirty(true);
    const onSubmit = () => setDirty(false);

    form.addEventListener("input", onInput);
    form.addEventListener("submit", onSubmit);

    return () => {
      form.removeEventListener("input", onInput);
      form.removeEventListener("submit", onSubmit);
    };
  }, []);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, message]);

  return <span ref={marker} className="hidden" aria-hidden="true" />;
}
