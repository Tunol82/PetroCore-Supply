"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Tone = "success" | "error" | "info";

type ToastItem = { id: number; message: string; tone: Tone };

type ToastApi = { push: (message: string, tone?: Tone) => void };

const ToastContext = createContext<ToastApi>({ push: () => undefined });

const toneClass: Record<Tone, string> = {
  success: "border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]",
  error: "border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]",
  info: "border-[var(--brand)]/30 bg-[var(--brand-soft)] text-[var(--brand)]",
};

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, tone: Tone = "success") => {
    counter.current += 1;
    const id = counter.current;
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto rounded-[var(--radius)] border px-4 py-3 text-sm font-medium shadow-[var(--shadow-md)] ${toneClass[item.tone]}`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Mirrors a server action's inline feedback into a toast, so a result is still
 * visible after the form re-renders or the user moves on.
 */
export function ToastOnState({ state }: { state: { error: string | null; success: string | null } }) {
  const toast = useToast();
  const last = useRef<string | null>(null);

  useEffect(() => {
    // Success is mirrored into a toast so it survives navigation. Errors stay
    // inline, next to the fields that need attention.
    if (!state.success) {
      last.current = null;
      return;
    }

    if (state.success !== last.current) {
      last.current = state.success;
      toast.push(state.success, "success");
    }
  }, [state.success, toast]);

  return null;
}
