import { TASK_NATIVE_QUICK_ENTRY_COMMANDS } from '@/modules/tasks/domain/taskNativeQuickEntryContract';

export type TaskKeyboardCommand =
  | 'undo'
  | 'redo'
  | 'select-all'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'duplicate'
  | 'keyboard-help'
  | 'close-task'
  | 'capture'
  | 'view-today'
  | 'view-upcoming'
  | 'view-anytime'
  | 'view-someday'
  | 'view-done'
  | 'view-config'
  | 'toggle-completion'
  | 'open-start-date'
  | 'clear-start'
  | 'set-someday'
  | 'cycle-horizon'
  | 'cycle-actionability'
  | 'cycle-area'
  | 'focus-reminder'
  | 'focus-link'
  | 'focus-notes'
  | 'start-selection'
  | 'open-deadline'
  | 'open-checklist'
  | 'open-previous'
  | 'open-next';

type TaskKeyboardGesture = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
>;

const taskControlCommands: Record<string, TaskKeyboardCommand> = {
  q: 'close-task',
  w: 'open-previous',
  e: 'open-start-date',
  r: 'clear-start',
  t: 'cycle-horizon',
  y: 'focus-reminder',
  n: 'focus-notes',
  a: 'capture',
  s: 'open-next',
  d: 'open-deadline',
  f: 'cycle-actionability',
  g: 'set-someday',
  h: 'focus-link',
  z: 'undo',
  x: 'toggle-completion',
  c: 'open-checklist',
  v: 'cycle-area',
  b: 'start-selection',
};

const applicationCommands: Record<string, TaskKeyboardCommand> = {
  '/': 'keyboard-help',
  '1': 'view-today',
  '2': 'view-upcoming',
  '3': 'view-anytime',
  '4': 'view-someday',
  '5': 'view-done',
  '6': 'view-config',
  y: 'redo',
  a: 'select-all',
  d: 'duplicate',
  x: 'cut',
  c: 'copy',
  v: 'paste',
  z: 'undo',
  enter: 'close-task',
  escape: 'close-task',
};

const viewNavigationCommands: Record<string, TaskKeyboardCommand> = {
  '1': 'view-today',
  '2': 'view-upcoming',
  '3': 'view-anytime',
  '4': 'view-someday',
  '5': 'view-done',
  '6': 'view-config',
};

const nativeQuickEntryMetadataCommands = new Set<TaskKeyboardCommand>(
  TASK_NATIVE_QUICK_ENTRY_COMMANDS.map(({ command }) => command),
);

export function isTaskNativeQuickEntryMetadataCommand(
  command: TaskKeyboardCommand,
): boolean {
  return nativeQuickEntryMetadataCommands.has(command);
}

export function getTaskKeyboardCommand(
  gesture: TaskKeyboardGesture,
  macLikePlatform: boolean,
): TaskKeyboardCommand | null {
  const key = gesture.key.toLowerCase();
  const applicationModifier = macLikePlatform
    ? gesture.metaKey && !gesture.ctrlKey
    : gesture.ctrlKey && !gesture.metaKey;
  const taskControlModifier = macLikePlatform
    ? gesture.ctrlKey
      && !gesture.metaKey
      && !gesture.altKey
      && !gesture.shiftKey
    : gesture.altKey
      && gesture.shiftKey
      && !gesture.metaKey
      && !gesture.ctrlKey;

  if (applicationModifier && !gesture.altKey && gesture.shiftKey && key === 'z') {
    return 'redo';
  }
  if (
    macLikePlatform
    && taskControlModifier
    && viewNavigationCommands[key]
  ) {
    return viewNavigationCommands[key];
  }
  if (taskControlModifier) return taskControlCommands[key] ?? null;

  if (applicationModifier && !gesture.altKey) {
    if (gesture.shiftKey) return null;
    return applicationCommands[key] ?? null;
  }

  return null;
}
