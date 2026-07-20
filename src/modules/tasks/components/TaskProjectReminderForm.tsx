import { Bell, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Input } from '@/components/ui/input';
import {
  getTaskReminderUnavailableMessage,
  type TaskReminderAvailability,
} from '@/modules/tasks/components/taskReminderAvailability';
import type { TaskReminder } from '@/modules/tasks/types/tasks';

export type ProjectReminderInput = {
  localDate: string;
  localTime: string;
  ambiguityChoice: 'earlier' | 'later';
};

export function TaskProjectReminderForm({
  projectId,
  reminder,
  mode,
  timeZone,
  onSave,
  onCancel,
}: {
  projectId: string;
  reminder: TaskReminder | null;
  mode: TaskReminderAvailability;
  timeZone: string;
  onSave: (input: ProjectReminderInput) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [localDate, setLocalDate] = useState(reminder?.local_date ?? '');
  const [localTime, setLocalTime] = useState(reminder?.local_time.slice(0, 5) ?? '09:00');
  const [ambiguityChoice, setAmbiguityChoice] = useState<'earlier' | 'later'>(
    reminder?.ambiguity_choice ?? 'earlier',
  );
  const [saving, setSaving] = useState(false);
  const connected = mode === 'connected';
  const changed = localDate !== (reminder?.local_date ?? '')
    || (localDate !== '' && localTime !== (reminder?.local_time.slice(0, 5) ?? '09:00'))
    || ambiguityChoice !== (reminder?.ambiguity_choice ?? 'earlier');
  const invalid = Boolean(localDate && !localTime);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!connected || !changed || invalid || saving) return;
    setSaving(true);
    try {
      if (localDate) {
        await onSave({ localDate, localTime, ambiguityChoice });
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
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor={`project-reminder-date-${projectId}`}
          >
            Date
          </label>
          <div className="flex gap-2">
            <DatePickerField
              id={`project-reminder-date-${projectId}`}
              value={localDate}
              onValueChange={setLocalDate}
              disabled={saving || !connected}
              placeholder="No Reminder"
              aria-label="Project Reminder Date"
            />
            {localDate ? (
              <Button
                type="button"
                variant="clear"
                size="icon"
                disabled={saving || !connected}
                aria-label="Clear Project Reminder"
                onClick={() => setLocalDate('')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor={`project-reminder-time-${projectId}`}
          >
            Time
          </label>
          <Input
            id={`project-reminder-time-${projectId}`}
            type="time"
            value={localTime}
            onChange={(event) => setLocalTime(event.target.value)}
            disabled={saving || !connected || !localDate}
          />
        </div>
      </div>
      {localDate ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor={`project-reminder-ambiguity-${projectId}`}
            >
              Repeated Local Time
            </label>
            <select
              id={`project-reminder-ambiguity-${projectId}`}
              value={ambiguityChoice}
              onChange={(event) => setAmbiguityChoice(
                event.target.value as 'earlier' | 'later',
              )}
              disabled={saving || !connected}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="earlier">Earlier Instance</option>
              <option value="later">Later Instance</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Time Zone</span>
            <p className="flex h-10 items-center text-sm text-muted-foreground">{timeZone}</p>
          </div>
        </div>
      ) : null}
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
          disabled={!connected || !changed || invalid || saving}
        >
          Save Reminder
        </Button>
      </div>
    </form>
  );
}
