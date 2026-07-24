export type TaskKeyboardCommand =
  | 'undo'
  | 'redo'
  | 'select-all'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'duplicate'
  | 'help'
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
  | 'cycle-horizon'
  | 'cycle-actionability'
  | 'focus-reminder'
  | 'open-deadline'
  | 'open-organization'
  | 'open-checklist'
  | 'open-previous'
  | 'open-next';

type TaskKeyboardGesture = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
>;

const taskControlCommands: Record<string, TaskKeyboardCommand> = {
  w: 'view-today',
  e: 'view-upcoming',
  r: 'view-anytime',
  t: 'view-someday',
  y: 'view-done',
  u: 'view-config',
  a: 'toggle-completion',
  s: 'open-previous',
  d: 'open-start-date',
  f: 'cycle-horizon',
  g: 'cycle-actionability',
  h: 'focus-reminder',
  z: 'close-task',
  x: 'open-next',
  c: 'open-deadline',
  v: 'open-organization',
  b: 'open-checklist',
  n: 'capture',
};

export function getTaskKeyboardCommand(
  gesture: TaskKeyboardGesture,
  macLikePlatform: boolean,
): TaskKeyboardCommand | null {
  const key = gesture.key.toLowerCase();
  const applicationModifier = macLikePlatform
    ? gesture.metaKey && !gesture.ctrlKey
    : gesture.ctrlKey && !gesture.metaKey;
  const taskControlModifier = gesture.ctrlKey
    && !gesture.metaKey
    && !gesture.altKey
    && gesture.shiftKey === !macLikePlatform;

  if (taskControlModifier) return taskControlCommands[key] ?? null;

  if (applicationModifier && !gesture.altKey) {
    if (key === 'z') {
      if (gesture.shiftKey) return macLikePlatform ? 'redo' : 'close-task';
      return 'undo';
    }
    if (gesture.shiftKey) return null;
    if (key === 'y') return 'redo';
    if (key === 'a') return 'select-all';
    if (key === 'd') return 'duplicate';
    if (key === 'x') return 'cut';
    if (key === 'c') return 'copy';
    if (key === 'v') return 'paste';
    if (key === '/') return 'help';
    if (key === 'enter' || key === 'escape') return 'close-task';
  }

  return null;
}
