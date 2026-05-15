import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { Loader2, X } from "lucide-react";

export interface JsonEditorModalProps {
  open: boolean;
  title: string;
  description?: string;
  initialValue: unknown;
  onSave: (parsed: unknown) => void | Promise<void>;
  onDismiss: () => void;
  onDelete?: () => void | Promise<void>;
  deleteLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;
  backdropClassName?: string;
}

function stringifyValue(value: unknown): string {
  if (value === undefined) return "null";
  return JSON.stringify(value, null, 2);
}

export function JsonEditorModal({
  open,
  title,
  description,
  initialValue,
  onSave,
  onDismiss,
  onDelete,
  deleteLabel = "Delete",
  saveLabel = "Save",
  cancelLabel = "Cancel",
  backdropClassName = "bg-black/40",
}: JsonEditorModalProps) {
  const [text, setText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = saving || deleting;

  useEffect(() => {
    if (!open) return;
    setText(stringifyValue(initialValue));
    setParseError(null);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss, busy]);

  const tryParse = (): unknown | null => {
    try {
      const parsed = JSON.parse(text);
      setParseError(null);
      return parsed;
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
      return null;
    }
  };

  const handleFormat = () => {
    const parsed = tryParse();
    if (parsed !== null) setText(JSON.stringify(parsed, null, 2));
  };

  const handleSave = async () => {
    const parsed = tryParse();
    if (parsed === null) return;
    setSaving(true);
    try {
      await onSave(parsed);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 ${backdropClassName} cursor-pointer`}
        aria-hidden
        onClick={() => {
          if (!busy) onDismiss();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="json-editor-modal-title"
        className="relative z-10 flex w-full max-w-2xl max-h-[min(90vh,720px)] flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-4 shrink-0">
          <div className="min-w-0">
            <h2 id="json-editor-modal-title" className="text-xl font-semibold text-zinc-100">
              {title}
            </h2>
            {description ? <p className="text-sm text-zinc-400 mt-1">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 px-6 py-4">
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (parseError) setParseError(null);
            }}
            disabled={busy}
            spellCheck={false}
            className="min-h-[280px] max-h-[50vh] font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-100 resize-y"
          />
          {parseError ? <p className="text-sm text-red-400 mt-2">{parseError}</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-6 py-4 shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={handleFormat} disabled={busy}>
            Format JSON
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onDelete ? (
              <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={busy} className="gap-2">
                {deleting ? <Loader2 className="animate-spin" size={16} /> : null}
                {deleteLabel}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={onDismiss} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={busy} className="gap-2 bg-orange-500 hover:bg-orange-600 text-black">
              {saving ? <Loader2 className="animate-spin" size={16} /> : null}
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
