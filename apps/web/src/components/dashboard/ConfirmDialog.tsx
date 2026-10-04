'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { errorMessage } from '@/lib/firebase/api';

/**
 * Modal confirmation built on <dialog>. Optionally asks for a note (for rejections and
 * refunds). `onConfirm` may throw; the message is shown in the dialog.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  note,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  note?: { label: string; required?: boolean; placeholder?: string };
  onConfirm: (note: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const close = () => {
    if (pending) return;
    setText('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (note?.required && !text.trim()) {
      setError(`${note.label} is required.`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onConfirm(text.trim());
      setText('');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onCancel={(e) => { e.preventDefault(); close(); }}
      className="m-auto w-[calc(100%-32px)] max-w-md bg-paper p-0 text-ink backdrop:bg-black/40"
    >
      {open ? (
        <form
          method="dialog"
          className="p-6"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
        >
          <h2 id={`${id}-title`} className="display text-[24px]">{title}</h2>
          {body ? <div className="mt-3 text-sm text-ink-2">{body}</div> : null}
          {note ? (
            <div className="mt-5">
              <label htmlFor={`${id}-note`} className="field-label">{note.label}{note.required ? '' : ' (optional)'}</label>
              <textarea
                id={`${id}-note`}
                className="field min-h-[96px]"
                value={text}
                maxLength={500}
                placeholder={note.placeholder}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          ) : null}
          {error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary min-h-10" onClick={close} disabled={pending}>Cancel</button>
            <button type="submit" className={`btn min-h-10 ${danger ? 'border border-danger bg-danger text-paper hover:opacity-90' : 'btn-primary'}`} disabled={pending}>
              {pending ? 'Working…' : confirmLabel}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
