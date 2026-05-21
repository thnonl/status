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
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-medium text-slate-200 transition hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              danger
                ? "rounded-xl bg-rose-500 px-3 py-2 font-semibold text-white transition hover:bg-rose-400"
                : "rounded-xl bg-cyan-400 px-3 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300"
            }
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {description ? <p className="text-slate-300">{description}</p> : null}
    </Modal>
  );
}
