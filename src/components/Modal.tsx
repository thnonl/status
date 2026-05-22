"use client";

import { ReactNode, useEffect, useId, useRef } from "react";

export function Modal({
  title,
  children,
  footer,
  open = true,
  onClose,
  descriptionId,
}: {
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  onClose: () => void;
  descriptionId?: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;

    const focusFirstElement = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        [
          'button:not([disabled])',
          '[href]',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(", "),
      );

      focusableElements[0]?.focus();
      if (!focusableElements[0]) dialog.focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };

    document.addEventListener("keydown", handleKeyDown);
    focusFirstElement();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement.current?.focus?.();
    };
  }, [open]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        [
          'button:not([disabled])',
          '[href]',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(", "),
      ),
    ).filter((element) => !element.hasAttribute("disabled"));

    if (!focusableElements.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-2xl rounded-xl border border-white/10 bg-slate-950 p-6 shadow-2xl outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-xl font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg px-3 py-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const messageId = useId();

  return (
    <Modal title={title} onClose={onClose} descriptionId={messageId}>
      <p id={messageId} className="text-slate-300">
        {message}
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 px-3 py-2 text-slate-200 hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl bg-rose-500 px-3 py-2 font-semibold text-white hover:bg-rose-400"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

