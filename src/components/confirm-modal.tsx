"use client";

import { Modal } from "@/components/Modal";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-lg border border-white/10 bg-white/5 px-4 font-medium text-slate-200 transition-colors hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              danger
                ? "h-10 rounded-lg bg-rose-500 px-4 font-semibold text-white transition-colors hover:bg-rose-400"
                : "h-10 rounded-lg bg-cyan-400 px-4 font-semibold text-slate-950 transition-colors hover:bg-cyan-300"
            }
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {description ? <p className="text-sm leading-relaxed text-slate-300">{description}</p> : null}
    </Modal>
  );
}

