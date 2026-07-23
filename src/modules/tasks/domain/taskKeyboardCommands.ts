export type TaskKeyboardCommand =
  | 'undo'
  | 'redo'
  | 'capture'
  | 'help'
  | 'view-today'
  | 'view-upcoming'
  | 'view-anytime'
  | 'view-someday'
  | 'view-projects'
  | 'view-templates'
  | 'view-done'
  | 'view-config'
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
  '7': 'view-done',
  '8': 'view-config',
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
  if (applicationModifier && !gesture.altKey && !gesture.shiftKey) {
    if (key === 'n') return 'capture';
    if (key === '/') return 'help';
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
