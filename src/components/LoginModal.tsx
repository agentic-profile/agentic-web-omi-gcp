import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { LogIn, X } from "lucide-react";

export interface LoginModalProps {
  open: boolean;
  onLogin: () => void | Promise<void>;
  /** If set, user can dismiss via backdrop, Escape, or close control. */
  onDismiss?: () => void;
  title?: string;
  description?: string;
  /** Tailwind classes for the dimmed overlay (keep light so the page behind stays visible). */
  backdropClassName?: string;
}

export function LoginModal({
  open,
  onLogin,
  onDismiss,
  title = "Sign in required",
  description = "Please log in with Google to continue.",
  backdropClassName = "bg-black/30",
}: LoginModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !onDismiss) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 ${backdropClassName} ${onDismiss ? "cursor-pointer" : ""}`}
        aria-hidden
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
      >
        <div className="flex justify-between items-start gap-4 mb-2">
          <h2 id="login-modal-title" className="text-xl font-semibold text-zinc-100 pr-2">
            {title}
          </h2>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <p className="text-zinc-400 text-sm mb-6">{description}</p>
        <Button
          className="w-full gap-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold"
          onClick={() => void onLogin()}
        >
          <LogIn size={18} /> Login with Google
        </Button>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
