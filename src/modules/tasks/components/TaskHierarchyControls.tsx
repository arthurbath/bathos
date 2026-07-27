import { Check, Pencil, X, type LucideIcon } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export function TaskHierarchyEditableTitle({
  id,
  value,
  onSave,
}: {
  id?: string;
  value: string;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(value);
  const [saving, setSaving] = useState(false);
  const titleButtonRef = useRef<HTMLButtonElement>(null);

  const restoreTitleFocus = () => window.setTimeout(() => titleButtonRef.current?.focus(), 0);
  const cancel = () => {
    setTitle(value);
    setEditing(false);
    restoreTitleFocus();
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle || saving) return;
    if (normalizedTitle === value) {
      cancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(normalizedTitle);
      setEditing(false);
      restoreTitleFocus();
    } catch (error) {
      showError('Name Could Not Be Saved', error);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        ref={titleButtonRef}
        id={id}
        type="button"
        onClick={() => {
          setTitle(value);
          setEditing(true);
        }}
        className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {value}
        <Pencil className="ml-2 inline h-3 w-3 text-muted-foreground" aria-hidden="true" />
      </button>
    );
  }

  return (
    <form className="flex min-w-0 flex-1 gap-1" onSubmit={save}>
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={saving}
        aria-label={`Rename ${value}`}
        className="h-9"
      />
      <Button
        type="submit"
        data-bathos-form-submit="true"
        variant="clear"
        size="icon"
        disabled={saving || !title.trim()}
        aria-label="Save Name"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        data-bathos-form-cancel="true"
        variant="clear"
        size="icon"
        disabled={saving}
        aria-label="Cancel Rename"
        onClick={cancel}
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
}

export function TaskHierarchyOrderButton({
  label,
  icon: Icon,
  action,
}: {
  label: string;
  icon: LucideIcon;
  action?: () => Promise<unknown>;
}) {
  return (
    <Button
      type="button"
      variant="clear"
      size="icon"
      disabled={!action}
      aria-label={label}
      className="h-9 w-9"
      onClick={() => {
        void action?.().catch((error) => showError('Order Could Not Be Saved', error));
      }}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function showError(title: string, error: unknown) {
  toast({
    title,
    description: error instanceof Error ? error.message : 'Unknown error',
    variant: 'destructive',
  });
}
