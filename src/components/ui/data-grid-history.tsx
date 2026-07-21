import * as React from 'react';

interface GridHistoryFocusTarget {
  gridId: string;
  rowId: string;
  col: number;
}

interface RegisteredGrid {
  restoreFocus: (target: Omit<GridHistoryFocusTarget, 'gridId'>) => void;
}

interface GridHistoryEntry {
  id: string;
  undoFocusTarget: GridHistoryFocusTarget | null;
  redoFocusTarget: GridHistoryFocusTarget | null;
  undo: () => void | Promise<unknown>;
  redo: () => void | Promise<unknown>;
  invalidated: boolean;
}

interface DataGridHistoryContextValue {
  registerGrid: (gridId: string, registration: RegisteredGrid) => () => void;
  recordHistoryEntry: (entry: Omit<GridHistoryEntry, 'id' | 'invalidated'>) => string;
  invalidateHistoryEntry: (entryId: string | null | undefined) => void;
}

const DataGridHistoryContext = React.createContext<DataGridHistoryContextValue | null>(null);

function isEditableTextTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return !target.readOnly && !target.disabled;
  if (target instanceof HTMLInputElement) {
    const nonTextTypes = new Set([
      'button',
      'checkbox',
      'color',
      'file',
      'hidden',
      'image',
      'radio',
      'range',
      'reset',
      'submit',
    ]);
    if (nonTextTypes.has(target.type)) return false;
    return !target.readOnly && !target.disabled;
  }
  return target.isContentEditable;
}

function isUndoShortcut(event: KeyboardEvent) {
  return (
    (event.metaKey || event.ctrlKey)
    && !event.altKey
    && !event.shiftKey
    && event.key.toLowerCase() === 'z'
  );
}

function isRedoShortcut(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  return (
    (event.metaKey || event.ctrlKey)
    && !event.altKey
    && (
      (event.shiftKey && key === 'z')
      || (!event.shiftKey && key === 'y')
    )
  );
}

function scheduleFocus(callback: () => void) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => callback());
    return;
  }
  callback();
}

export function DataGridHistoryProvider({
  children,
  resetKey,
}: {
  children: React.ReactNode;
  resetKey?: string;
}) {
  const gridsRef = React.useRef(new Map<string, RegisteredGrid>());
  const undoStackRef = React.useRef<GridHistoryEntry[]>([]);
  const redoStackRef = React.useRef<GridHistoryEntry[]>([]);
  const entryCounterRef = React.useRef(0);
  const operationInFlightRef = React.useRef(false);
  const resetGenerationRef = React.useRef(0);

  React.useEffect(() => {
    resetGenerationRef.current += 1;
    undoStackRef.current = [];
    redoStackRef.current = [];
    entryCounterRef.current = 0;
    operationInFlightRef.current = false;
  }, [resetKey]);

  const registerGrid = React.useCallback((gridId: string, registration: RegisteredGrid) => {
    gridsRef.current.set(gridId, registration);
    return () => {
      const current = gridsRef.current.get(gridId);
      if (current === registration) {
        gridsRef.current.delete(gridId);
      }
    };
  }, []);

  const recordHistoryEntry = React.useCallback((entry: Omit<GridHistoryEntry, 'id' | 'invalidated'>) => {
    entryCounterRef.current += 1;
    const id = `grid-history-${entryCounterRef.current}`;
    undoStackRef.current.push({
      ...entry,
      id,
      invalidated: false,
    });
    redoStackRef.current = [];
    return id;
  }, []);

  const invalidateHistoryEntry = React.useCallback((entryId: string | null | undefined) => {
    if (!entryId) return;
    const markInvalid = (entries: GridHistoryEntry[]) => {
      const entry = entries.find((candidate) => candidate.id === entryId);
      if (entry) entry.invalidated = true;
    };
    markInvalid(undoStackRef.current);
    markInvalid(redoStackRef.current);
  }, []);

  React.useEffect(() => {
    const popValidEntry = (entries: GridHistoryEntry[]) => {
      while (entries.length > 0) {
        const entry = entries.pop();
        if (entry && !entry.invalidated) return entry;
      }
      return null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || operationInFlightRef.current) return;
      if (!isUndoShortcut(event) && !isRedoShortcut(event)) return;
      if (isEditableTextTarget(event.target)) return;

      const direction = isUndoShortcut(event) ? 'undo' : 'redo';
      const sourceStack = direction === 'undo' ? undoStackRef.current : redoStackRef.current;
      const destinationStack = direction === 'undo' ? redoStackRef.current : undoStackRef.current;
      const entry = popValidEntry(sourceStack);
      if (!entry) return;

      event.preventDefault();
      event.stopPropagation();
      operationInFlightRef.current = true;
      const operationGeneration = resetGenerationRef.current;

      void Promise.resolve(direction === 'undo' ? entry.undo() : entry.redo())
        .then(() => {
          if (resetGenerationRef.current !== operationGeneration) return;
          destinationStack.push(entry);
          const focusTarget = direction === 'undo' ? entry.undoFocusTarget : entry.redoFocusTarget;
          if (!focusTarget) return;
          const grid = gridsRef.current.get(focusTarget.gridId);
          if (!grid) return;
          scheduleFocus(() => {
            grid.restoreFocus({
              rowId: focusTarget.rowId,
              col: focusTarget.col,
            });
          });
        })
        .catch(() => {
          if (resetGenerationRef.current !== operationGeneration) return;
          sourceStack.push(entry);
        })
        .finally(() => {
          if (resetGenerationRef.current !== operationGeneration) return;
          operationInFlightRef.current = false;
        });
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const value = React.useMemo<DataGridHistoryContextValue>(() => ({
    registerGrid,
    recordHistoryEntry,
    invalidateHistoryEntry,
  }), [invalidateHistoryEntry, recordHistoryEntry, registerGrid]);

  return (
    <DataGridHistoryContext.Provider value={value}>
      {children}
    </DataGridHistoryContext.Provider>
  );
}

export function useDataGridHistory() {
  return React.useContext(DataGridHistoryContext);
}
