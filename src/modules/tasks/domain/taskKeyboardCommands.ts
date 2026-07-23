export type TaskKeyboardCommand =
  | 'undo'
  | 'redo'
  | 'select-all'
  | 'capture'
  | 'find'
  | 'help'
  | 'view-today'
  | 'view-upcoming'
  | 'view-anytime'
  | 'view-someday'
  | 'view-projects'
  | 'view-templates'
  | 'view-config'
  | 'plan-today'
  | 'plan-anytime'
  | 'plan-someday'
  | 'open-deadline'
  | 'duplicate'
  | 'open-start-date'
  | 'open-organization'
  | 'cycle-horizon'
  | 'focus-reminder'
  | 'complete-open'
  | 'open-next'
  | 'open-previous'
  | 'close-editor';

type TaskKeyboardGesture = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
>;

const numberedTaskCommands: Record<string, TaskKeyboardCommand> = {
  '1': 'view-today',
  '2': 'view-upcoming',
  '3': 'view-anytime',
  '4': 'view-someday',
  '5': 'view-projects',
  '6': 'view-templates',
};

export function getTaskKeyboardCommand(
  gesture: TaskKeyboardGesture,
  macLikePlatform: boolean,
): TaskKeyboardCommand | null {
  const key = gesture.key.toLowerCase();
  const applicationModifier = macLikePlatform
    ? gesture.metaKey && !gesture.ctrlKey
    : gesture.ctrlKey && !gesture.metaKey;

  if (applicationModifier && !gesture.altKey && key === 'z') {
    return gesture.shiftKey ? 'redo' : 'undo';
  }
  if (applicationModifier && !gesture.altKey && gesture.shiftKey && key === 'd') {
    if (macLikePlatform) return 'duplicate';
  }
  if (applicationModifier && !gesture.altKey && !gesture.shiftKey) {
    if (key === 'a') return 'select-all';
    if (key === 'n') return 'capture';
    if (key === 'f') return 'find';
    if (key === '/') return 'help';
    if (key === ',') return 'view-config';
    if (key === 't') return 'plan-today';
    if (key === 'r') return 'plan-anytime';
    if (key === 'o') return 'plan-someday';
    if (key === 'd') return 'open-deadline';
    if (key === 's') return 'open-start-date';
    if (key === 'm') return 'open-organization';
    if (key === 'h') return 'cycle-horizon';
    if (key === 'e') return 'focus-reminder';
    if (numberedTaskCommands[key]) return numberedTaskCommands[key];
  }

  const taskControlModifier = gesture.ctrlKey
    && !gesture.metaKey
    && !gesture.altKey
    && gesture.shiftKey === !macLikePlatform;
  if (!taskControlModifier) return null;
  if (key === 'd') return 'complete-open';
  if (key === 's') return 'open-next';
  if (key === 'w') return 'open-previous';
  if (key === 'x') return 'close-editor';
  return null;
}
