import { Bell, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getTaskReminderUnavailableMessage,
  type TaskReminderAvailability,
} from '@/modules/tasks/components/taskReminderAvailability';
import type { TaskReminder } from '@/modules/tasks/types/tasks';

export type ProjectReminderInput = {
  localTime: string;
  ambiguityChoice: 'earlier' | 'later';
};

export function TaskProjectReminderForm({
  projectId,
  reminder,
  mode,
  onSave,
  onCancel,
}: {
  projectId: string;
  reminder: TaskReminder | null;
  mode: TaskReminderAvailability;
  onSave: (input: ProjectReminderInput) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [localTime, setLocalTime] = useState(reminder?.local_time.slice(0, 5) ?? '');
  const [saving, setSaving] = useState(false);
  const connected = mode === 'connected';
  const changed = localTime !== (reminder?.local_time.slice(0, 5) ?? '');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!connected || !changed || saving) return;
    setSaving(true);
    try {
      if (localTime) {
        await onSave({ localTime, ambiguityChoice: 'earlier' });
      } else if (reminder) {
        await onCancel();
      }
    } catch {
      // The parent reports the service error and this form remains available for retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      aria-label="Project Reminder"
      onSubmit={save}
      className="space-y-4 rounded-md border border-[hsl(var(--grid-sticky-line))] p-4"
    >
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-foreground">Reminder</h4>
      </div>
      <div className="space-y-1.5">
        <label
          className="text-sm font-medium text-foreground"
          htmlFor={`project-reminder-time-${projectId}`}
        >
          Time
        </label>
        <div className="flex gap-2">
          <Input
            id={`project-reminder-time-${projectId}`}
            type="time"
            value={localTime}
            onChange={(event) => setLocalTime(event.target.value)}
            disabled={saving || !connected}
          />
          {localTime ? (
            <Button
              type="button"
              variant="clear"
              size="icon"
              disabled={saving || !connected}
              aria-label="Clear Project Reminder"
              onClick={() => setLocalTime('')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      {!connected ? (
        <p className="text-xs text-warning">
          {getTaskReminderUnavailableMessage(mode)}
        </p>
      ) : reminder?.resolution_kind === 'gap_forward' ? (
        <p className="text-xs text-warning">
          This local time was adjusted to the first valid instant after a daylight-saving gap.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={!connected || !changed || saving}
        >
          Save Reminder
        </Button>
      </div>
    </form>
  );
}
