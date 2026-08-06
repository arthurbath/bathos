import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';

import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { isMacLikePlatform } from '@/lib/platform';
import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import {
  TaskImmediateDragHandle,
} from '@/modules/tasks/components/TaskImmediateDragHandle';
import { useTaskImmediateDragTarget } from '@/modules/tasks/components/TaskImmediateDragTarget';
import {
  parseTaskChecklistClipboard,
  serializeTaskChecklistClipboard,
  type TaskChecklistClipboardItem,
} from '@/modules/tasks/domain/taskChecklistClipboard';
import {
  createTaskClipboardRepresentations,
  readTaskClipboardStructuredText,
  TASK_CHECKLIST_CLIPBOARD_MIME_TYPE,
  TASK_CHECKLIST_CLIPBOARD_WEB_MIME_TYPE,
  type TaskClipboardRepresentations,
} from '@/modules/tasks/domain/taskClipboardRepresentations';
import { applyTaskSelectionGesture } from '@/modules/tasks/domain/taskSelection';
import { planChecklistMultilinePaste } from '@/modules/tasks/domain/taskMultilinePaste';
import { useTaskChecklist } from '@/modules/tasks/hooks/useTaskChecklist';
import type { TaskChecklistItem } from '@/modules/tasks/types/tasks';

const AUTOSAVE_DELAY_MS = 350;
const DRAFT_ID = 'draft';

type CaretPosition = 'start' | 'end' | number;

export type TaskChecklistEditorItem = Pick<
  TaskChecklistItem,
  'id' | 'title' | 'completed' | 'order_key'
>;

export type TaskChecklistEditorController = {
  items: TaskChecklistEditorItem[];
  loading: boolean;
  createItem: (
    title: string,
    destinationIndex?: number,
    context?: { occurredAt?: string; operationId?: string },
  ) => Promise<TaskChecklistEditorItem>;
  createItems: (
    titles: readonly string[],
    destinationIndex?: number,
    context?: { occurredAt?: string; operationId?: string },
  ) => Promise<TaskChecklistEditorItem[]>;
  createItemCopies: (
    items: readonly TaskChecklistClipboardItem[],
    destinationIndex?: number,
    context?: { occurredAt?: string; operationId?: string },
  ) => Promise<TaskChecklistEditorItem[]>;
  updateItem: (
    itemId: string,
    patch: { title?: string; completed?: boolean; completed_at?: string | null; order_key?: string },
    context?: { occurredAt?: string; operationId?: string },
  ) => Promise<TaskChecklistEditorItem>;
  setCompleted: (
    item: TaskChecklistEditorItem,
    completed: boolean,
    context?: { occurredAt?: string; operationId?: string },
  ) => Promise<TaskChecklistEditorItem>;
  deleteItem: (
    itemId: string,
    context?: { occurredAt?: string; operationId?: string },
  ) => Promise<unknown>;
  deleteItems: (
    itemIds: readonly string[],
    context?: { occurredAt?: string; operationId?: string },
  ) => Promise<unknown>;
  reorderItems: (
    itemIds: readonly string[],
    destinationIndex: number,
    context?: { occurredAt?: string; operationId?: string },
  ) => Promise<TaskChecklistEditorItem[]>;
};

function isEligibleHorizontalBoundaryGesture(
  event: Pick<KeyboardEvent<HTMLInputElement>, 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
) {
  if (event.metaKey || event.ctrlKey || event.shiftKey) return false;
  return !event.altKey || isMacLikePlatform(globalThis.navigator?.platform ?? '');
}

export function TaskChecklistEditor({
  ownerId,
  taskId,
  focusRequestTaskId = taskId,
  emptyActionLayout = 'standalone',
  onContentPresenceChange,
  onRegisterFlush,
  showDragHandles = false,
}: {
  ownerId: string;
  taskId: string;
  focusRequestTaskId?: string;
  emptyActionLayout?: 'paired' | 'standalone';
  onContentPresenceChange?: (present: boolean) => void;
  onRegisterFlush?: (flush: (() => Promise<void>) | null) => void;
  showDragHandles?: boolean;
}) {
  const checklist = useTaskChecklist(ownerId, taskId);
  return (
    <TaskChecklistEditorSurface
      controller={checklist as unknown as TaskChecklistEditorController}
      focusRequestTaskId={focusRequestTaskId}
      emptyActionLayout={emptyActionLayout}
      onContentPresenceChange={onContentPresenceChange}
      onRegisterFlush={onRegisterFlush}
      showDragHandles={showDragHandles}
    />
  );
}

export function TaskChecklistEditorSurface({
  controller: checklist,
  focusRequestTaskId,
  emptyActionLayout = 'standalone',
  onContentPresenceChange,
  onRegisterFlush,
  showDragHandles = false,
}: {
  controller: TaskChecklistEditorController;
  focusRequestTaskId: string;
  emptyActionLayout?: 'paired' | 'standalone';
  onContentPresenceChange?: (present: boolean) => void;
  onRegisterFlush?: (flush: (() => Promise<void>) | null) => void;
  showDragHandles?: boolean;
}) {
  const [draftIndex, setDraftIndex] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [editingTitles, setEditingTitles] = useState<Record<string, string>>({});
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [draggedIds, setDraggedIds] = useState<string[]>([]);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [focusRevision, setFocusRevision] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const draggedIdsRef = useRef<string[]>([]);
  const dropIndexRef = useRef<number | null>(null);
  const dropCommitInFlightRef = useRef(false);
  const suppressPostDragClickRef = useRef(false);
  const checklistInputPressRef = useRef<{
    input: HTMLInputElement;
    x: number;
    y: number;
  } | null>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const editingTitlesRef = useRef<Record<string, string>>({});
  const persistedTitlesRef = useRef(new Map<string, string>());
  const pendingCompletionRowTopsRef = useRef<Map<string, number> | null>(null);
  const completionAnimationsRef = useRef<Animation[]>([]);
  const saveTimers = useRef(new Map<string, number>());
  const pendingInsertRef = useRef(false);
  const pendingDraftMutationRef = useRef<Promise<unknown> | null>(null);
  const draftIndexRef = useRef<number | null>(draftIndex);
  const draftTitleRef = useRef(draftTitle);
  const focusedItemIdRef = useRef<string | null>(null);
  const pendingFocusRef = useRef<{
    id: string;
    position: CaretPosition;
  } | null>(null);
  const itemsRef = useRef(checklist.items);
  const deleteItemRef = useRef(checklist.deleteItem);
  itemsRef.current = checklist.items;
  deleteItemRef.current = checklist.deleteItem;

  const updateDraftIndex = useCallback((
    next: number | null | ((current: number | null) => number | null),
  ) => {
    const value = typeof next === 'function' ? next(draftIndexRef.current) : next;
    draftIndexRef.current = value;
    setDraftIndex(value);
  }, []);

  const updateDraftTitle = useCallback((
    next: string | ((current: string) => string),
  ) => {
    const value = typeof next === 'function' ? next(draftTitleRef.current) : next;
    draftTitleRef.current = value;
    setDraftTitle(value);
  }, []);

  useEffect(() => {
    if (checklist.loading) return;
    onContentPresenceChange?.(checklist.items.length > 0 || draftIndex !== null);
  }, [
    checklist.items.length,
    checklist.loading,
    draftIndex,
    onContentPresenceChange,
  ]);

  const clearSelection = useCallback(() => {
    setSelectedItemIds((current) => (
      current.size === 0 ? current : new Set()
    ));
    setSelectionAnchorId(null);
  }, []);

  const updateDraggedIds = useCallback((nextDraggedIds: string[]) => {
    draggedIdsRef.current = nextDraggedIds;
    setDraggedIds(nextDraggedIds);
  }, []);

  const updateDropIndex = useCallback((nextDropIndex: number | null) => {
    dropIndexRef.current = nextDropIndex;
    setDropIndex(nextDropIndex);
  }, []);

  const clearDragState = useCallback(() => {
    draggedIdsRef.current = [];
    dropIndexRef.current = null;
    setDraggedIds([]);
    setDropIndex(null);
  }, []);
  const immediateDragScope = `task-checklist:${focusRequestTaskId}`;

  const requestInputFocus = useCallback((id: string, position: CaretPosition) => {
    pendingFocusRef.current = { id, position };
    setFocusRevision((current) => current + 1);
  }, []);

  const setEditingTitle = useCallback((itemId: string, title: string) => {
    editingTitlesRef.current = {
      ...editingTitlesRef.current,
      [itemId]: title,
    };
    setEditingTitles(editingTitlesRef.current);
  }, []);

  const cancelScheduledSave = useCallback((itemId: string) => {
    const timer = saveTimers.current.get(itemId);
    if (timer !== undefined) window.clearTimeout(timer);
    saveTimers.current.delete(itemId);
  }, []);

  const saveTitle = useCallback((
    item: TaskChecklistEditorItem,
    title: string,
  ) => {
    cancelScheduledSave(item.id);
    const normalized = title.trim();
    if (!normalized || normalized === item.title) return Promise.resolve(null);
    return checklist.updateItem(item.id, { title: normalized });
  }, [cancelScheduledSave, checklist]);

  const scheduleTitleSave = useCallback((
    item: TaskChecklistEditorItem,
    title: string,
  ) => {
    cancelScheduledSave(item.id);
    if (!title.trim()) return;
    const timer = window.setTimeout(() => {
      saveTimers.current.delete(item.id);
      consumeChecklistMutation(
        checklist.updateItem(item.id, { title: title.trim() }),
        'Checklist Item Could Not Be Saved',
      );
    }, AUTOSAVE_DELAY_MS);
    saveTimers.current.set(item.id, timer);
  }, [cancelScheduledSave, checklist]);

  const beginChecklist = useCallback(() => {
    const firstCompletedIndex = checklist.items.findIndex(({ completed }) => completed);
    const ordinaryInsertionIndex = firstCompletedIndex === -1
      ? checklist.items.length
      : firstCompletedIndex;
    const focusedEmptyDraft = focusedItemIdRef.current === DRAFT_ID
      && draftTitleRef.current.length === 0
      && draftIndexRef.current !== null;
    const nextDraftIndex = focusedEmptyDraft
      && draftIndexRef.current === ordinaryInsertionIndex
      && ordinaryInsertionIndex !== 0
      ? 0
      : ordinaryInsertionIndex;
    updateDraftIndex(nextDraftIndex);
    updateDraftTitle('');
    requestInputFocus(DRAFT_ID, 'start');
  }, [checklist.items, requestInputFocus, updateDraftIndex, updateDraftTitle]);

  useEffect(() => {
    const handleFocusRequest = (event: Event) => {
      if (
        event instanceof CustomEvent
        && event.detail?.taskId === focusRequestTaskId
      ) beginChecklist();
    };
    document.addEventListener('bathos:task-checklist-focus', handleFocusRequest);
    return () => document.removeEventListener(
      'bathos:task-checklist-focus',
      handleFocusRequest,
    );
  }, [beginChecklist, focusRequestTaskId]);

  useEffect(() => {
    const previousPersisted = persistedTitlesRef.current;
    const currentEditing = editingTitlesRef.current;
    const nextEditing: Record<string, string> = {};
    const nextPersisted = new Map<string, string>();
    for (const item of checklist.items) {
      const previousTitle = previousPersisted.get(item.id);
      const currentTitle = currentEditing[item.id];
      nextEditing[item.id] = currentTitle === undefined || currentTitle === previousTitle
        ? item.title
        : currentTitle;
      nextPersisted.set(item.id, item.title);
    }
    editingTitlesRef.current = nextEditing;
    persistedTitlesRef.current = nextPersisted;
    setEditingTitles(nextEditing);
  }, [checklist.items]);

  useEffect(() => {
    const availableIds = new Set(checklist.items.map(({ id }) => id));
    setSelectedItemIds((current) => {
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      if (
        next.size === current.size
        && [...next].every((id) => current.has(id))
      ) return current;
      return next;
    });
    setSelectionAnchorId((current) => (
      current !== null && availableIds.has(current) ? current : null
    ));
    if (
      focusedItemIdRef.current !== null
      && focusedItemIdRef.current !== DRAFT_ID
      && !availableIds.has(focusedItemIdRef.current)
    ) {
      focusedItemIdRef.current = null;
    }
  }, [checklist.items]);

  useEffect(() => () => {
    for (const animation of completionAnimationsRef.current) animation.cancel();
    for (const timer of saveTimers.current.values()) window.clearTimeout(timer);
    for (const item of itemsRef.current) {
      const value = editingTitlesRef.current[item.id]?.trim() ?? item.title.trim();
      if (value === '') {
        consumeChecklistMutation(
          deleteItemRef.current(item.id),
          'Checklist Item Could Not Be Deleted',
        );
      }
    }
  }, []);

  const prepareCompletionAnimation = useCallback(() => {
    const previousTops = new Map<string, number>();
    for (const [id, row] of rowRefs.current) {
      previousTops.set(id, row.getBoundingClientRect().top);
    }
    for (const animation of completionAnimationsRef.current) animation.cancel();
    completionAnimationsRef.current = [];
    pendingCompletionRowTopsRef.current = globalThis.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
      ? null
      : previousTops;
  }, []);

  useLayoutEffect(() => {
    const previousTops = pendingCompletionRowTopsRef.current;
    if (previousTops === null) return;
    pendingCompletionRowTopsRef.current = null;

    const animations: Animation[] = [];
    for (const [id, row] of rowRefs.current) {
      const previousTop = previousTops.get(id);
      if (previousTop === undefined) continue;
      const nextTop = row.getBoundingClientRect().top;
      const offset = previousTop - nextTop;
      if (Math.abs(offset) < 0.5) continue;
      animations.push(row.animate(
        [
          { transform: `translateY(${offset}px)` },
          { transform: 'translateY(0)' },
        ],
        { duration: 220, easing: 'ease-out' },
      ));
    }
    completionAnimationsRef.current = animations;
  }, [checklist.items, draftIndex]);

  useLayoutEffect(() => {
    const requested = pendingFocusRef.current;
    if (!requested) return;
    const input = inputRefs.current.get(requested.id);
    if (!input) return;
    input.focus({ preventScroll: true });
    const position = requested.position === 'start'
      ? 0
      : requested.position === 'end'
        ? input.value.length
        : Math.min(requested.position, input.value.length);
    input.setSelectionRange(position, position);
    pendingFocusRef.current = null;
  }, [checklist.items, draftIndex, focusRevision]);

  const commitDraft = useCallback(async ({
    keepFollowingDraft,
  }: {
    keepFollowingDraft: boolean;
  }) => {
    const title = draftTitleRef.current.trim();
    const insertionIndex = draftIndexRef.current;
    if (!title || insertionIndex === null || pendingInsertRef.current) return null;
    pendingInsertRef.current = true;
    try {
      const item = await checklist.createItem(title, insertionIndex);
      if (
        draftTitleRef.current.trim() !== title
        || draftIndexRef.current !== insertionIndex
      ) return item;

      updateDraftTitle('');
      if (keepFollowingDraft) {
        updateDraftIndex(insertionIndex + 1);
        requestInputFocus(DRAFT_ID, 'start');
      } else {
        updateDraftIndex(null);
      }
      return item;
    } finally {
      pendingInsertRef.current = false;
    }
  }, [checklist, requestInputFocus, updateDraftIndex, updateDraftTitle]);

  const splitPersistedItem = (
    item: TaskChecklistEditorItem,
    title: string,
    index: number,
    selectionStart: number,
    selectionEnd: number,
  ) => {
    cancelScheduledSave(item.id);
    const before = title.slice(0, selectionStart);
    const after = title.slice(selectionEnd);
    setEditingTitle(item.id, before);
    updateDraftTitle(after);
    updateDraftIndex(index + 1);
    requestInputFocus(DRAFT_ID, 'start');
    if (before.trim()) {
      consumeChecklistMutation(
        saveTitle(item, before),
        'Checklist Item Could Not Be Saved',
      );
    }
  };

  const splitDraft = async (
    index: number,
    selectionStart: number,
    selectionEnd: number,
  ) => {
    if (pendingInsertRef.current) return;
    const before = draftTitle.slice(0, selectionStart);
    const after = draftTitle.slice(selectionEnd);

    if (!before.trim()) {
      if (!after.trim()) {
        updateDraftIndex(Math.min(index + 1, checklist.items.length));
        requestInputFocus(DRAFT_ID, 'start');
        return;
      }
      pendingInsertRef.current = true;
      try {
        const item = await checklist.createItem(after.trim(), index);
        updateDraftTitle(before);
        updateDraftIndex(index);
        requestInputFocus(item.id, 'start');
      } finally {
        pendingInsertRef.current = false;
      }
      return;
    }

    pendingInsertRef.current = true;
    try {
      await checklist.createItem(before.trim(), index);
      updateDraftTitle(after);
      updateDraftIndex(index + 1);
      requestInputFocus(DRAFT_ID, 'start');
    } finally {
      pendingInsertRef.current = false;
    }
  };

  const pasteIntoPersistedItem = async (
    item: TaskChecklistEditorItem,
    title: string,
    index: number,
    selectionStart: number,
    selectionEnd: number,
    clipboardText: string,
  ) => {
    const plan = planChecklistMultilinePaste(
      title,
      selectionStart,
      selectionEnd,
      clipboardText,
    );
    if (plan === null || pendingInsertRef.current) return;

    pendingInsertRef.current = true;
    cancelScheduledSave(item.id);
    const [firstTitle, ...followingTitles] = plan.titles;
    const mutationContext = {
      occurredAt: new Date().toISOString(),
      operationId: globalThis.crypto.randomUUID(),
    };
    setEditingTitle(item.id, firstTitle);
    try {
      if (firstTitle.trim()) {
        await checklist.updateItem(
          item.id,
          { title: firstTitle.trim() },
          mutationContext,
        );
      }
      const created = await checklist.createItems(
        followingTitles,
        index + 1,
        mutationContext,
      );
      const finalItem = created.at(-1);
      if (finalItem) requestInputFocus(finalItem.id, plan.finalCaretOffset);
      else requestInputFocus(item.id, Math.min(firstTitle.length, plan.finalCaretOffset));
    } finally {
      pendingInsertRef.current = false;
    }
  };

  const pasteIntoDraft = async (
    index: number,
    selectionStart: number,
    selectionEnd: number,
    clipboardText: string,
  ) => {
    const plan = planChecklistMultilinePaste(
      draftTitle,
      selectionStart,
      selectionEnd,
      clipboardText,
    );
    if (plan === null || pendingInsertRef.current) return;

    pendingInsertRef.current = true;
    const finalTitle = plan.titles.at(-1) ?? '';
    try {
      const created = await checklist.createItems(
        plan.titles.slice(0, -1),
        index,
        { occurredAt: new Date().toISOString() },
      );
      updateDraftTitle(finalTitle);
      updateDraftIndex(index + created.length);
      requestInputFocus(DRAFT_ID, plan.finalCaretOffset);
    } finally {
      pendingInsertRef.current = false;
    }
  };

  const pasteChecklistItemsAfterPersisted = async (
    index: number,
    copiedItems: readonly TaskChecklistClipboardItem[],
  ) => {
    if (pendingInsertRef.current) return;
    pendingInsertRef.current = true;
    try {
      const created = await checklist.createItemCopies(
        copiedItems,
        index + 1,
        { occurredAt: new Date().toISOString() },
      );
      const finalItem = created.at(-1);
      if (finalItem) requestInputFocus(finalItem.id, 'end');
    } catch (error) {
      showChecklistError('Checklist Items Could Not Be Pasted', error);
    } finally {
      pendingInsertRef.current = false;
    }
  };

  const pasteChecklistItemsAtDraft = async (
    index: number,
    copiedItems: readonly TaskChecklistClipboardItem[],
  ) => {
    if (pendingInsertRef.current) return;
    pendingInsertRef.current = true;
    try {
      const created = await checklist.createItemCopies(
        copiedItems,
        index,
        { occurredAt: new Date().toISOString() },
      );
      updateDraftIndex(index + created.length);
      const finalItem = created.at(-1);
      if (finalItem) requestInputFocus(finalItem.id, 'end');
    } catch (error) {
      showChecklistError('Checklist Items Could Not Be Pasted', error);
    } finally {
      pendingInsertRef.current = false;
    }
  };

  const rejectChecklistPaste = (reason: string) => {
    showChecklistError('Checklist Items Could Not Be Pasted', new Error(reason));
  };

  const trackDraftMutation = useCallback((
    mutation: Promise<unknown>,
    failureTitle: string,
  ) => {
    pendingDraftMutationRef.current = mutation;
    void mutation
      .catch((error) => {
        showChecklistError(failureTitle, error);
      })
      .finally(() => {
        if (pendingDraftMutationRef.current === mutation) {
          pendingDraftMutationRef.current = null;
        }
      });
  }, []);

  const flushDraft = useCallback(async () => {
    const pendingMutation = pendingDraftMutationRef.current;
    if (pendingMutation !== null) {
      await pendingMutation.catch(() => undefined);
    }

    try {
      await commitDraft({ keepFollowingDraft: false });
    } catch (error) {
      showChecklistError('Checklist Item Could Not Be Saved', error);
      throw error;
    }
  }, [commitDraft]);

  useLayoutEffect(() => {
    onRegisterFlush?.(flushDraft);
    return () => onRegisterFlush?.(null);
  }, [flushDraft, onRegisterFlush]);

  const moveInputFocus = useCallback((
    currentId: string,
    direction: -1 | 1,
    position: CaretPosition = 'end',
  ) => {
    const visualIds = checklist.items.map(({ id }) => id);
    if (draftIndex !== null) visualIds.splice(draftIndex, 0, DRAFT_ID);
    const currentIndex = visualIds.indexOf(currentId);
    const destinationId = visualIds[currentIndex + direction];
    if (!destinationId) return false;
    requestInputFocus(destinationId, position);
    return true;
  }, [checklist.items, draftIndex, requestInputFocus]);

  const joinPrevious = async (
    item: TaskChecklistEditorItem,
    title: string,
    index: number,
  ) => {
    cancelScheduledSave(item.id);
    if (draftIndex === index) {
      const boundary = draftTitle.length;
      updateDraftTitle(`${draftTitle}${title}`);
      await checklist.deleteItem(item.id);
      requestInputFocus(DRAFT_ID, boundary);
      return;
    }
    const previous = checklist.items[index - 1];
    if (!previous) return;
    cancelScheduledSave(previous.id);
    const previousTitle = editingTitlesRef.current[previous.id] ?? previous.title;
    const combined = `${previousTitle}${title}`;
    const boundary = previousTitle.length;
    setEditingTitle(previous.id, combined);
    if (combined.trim()) await checklist.updateItem(previous.id, { title: combined.trim() });
    await checklist.deleteItem(item.id);
    requestInputFocus(previous.id, boundary);
  };

  const joinNext = async (
    item: TaskChecklistEditorItem,
    title: string,
    index: number,
  ) => {
    cancelScheduledSave(item.id);
    if (draftIndex === index + 1) {
      const boundary = title.length;
      const combined = `${title}${draftTitle}`;
      setEditingTitle(item.id, combined);
      updateDraftIndex(null);
      updateDraftTitle('');
      if (combined.trim()) await checklist.updateItem(item.id, { title: combined.trim() });
      requestInputFocus(item.id, boundary);
      return;
    }
    const next = checklist.items[index + 1];
    if (!next) return;
    cancelScheduledSave(next.id);
    const nextTitle = editingTitlesRef.current[next.id] ?? next.title;
    const combined = `${title}${nextTitle}`;
    const boundary = title.length;
    setEditingTitle(item.id, combined);
    if (combined.trim()) await checklist.updateItem(item.id, { title: combined.trim() });
    await checklist.deleteItem(next.id);
    requestInputFocus(item.id, boundary);
  };

  const joinDraftPrevious = async () => {
    if (draftIndex === null || draftIndex === 0) return;
    const previous = checklist.items[draftIndex - 1];
    if (!previous) return;
    cancelScheduledSave(previous.id);
    const previousTitle = editingTitlesRef.current[previous.id] ?? previous.title;
    const combined = `${previousTitle}${draftTitle}`;
    const boundary = previousTitle.length;
    setEditingTitle(previous.id, combined);
    updateDraftIndex(null);
    updateDraftTitle('');
    if (combined.trim()) await checklist.updateItem(previous.id, { title: combined.trim() });
    requestInputFocus(previous.id, boundary);
  };

  const joinDraftNext = async () => {
    if (draftIndex === null) return;
    const next = checklist.items[draftIndex];
    if (!next) return;
    cancelScheduledSave(next.id);
    const nextTitle = editingTitlesRef.current[next.id] ?? next.title;
    const boundary = draftTitle.length;
    updateDraftTitle(`${draftTitle}${nextTitle}`);
    await checklist.deleteItem(next.id);
    requestInputFocus(DRAFT_ID, boundary);
  };

  const handleSelectionMouseDown = (
    event: ReactMouseEvent<HTMLDivElement>,
    itemId: string,
  ) => {
    if (event.button !== 0) return;
    const platformModifier = isMacLikePlatform(globalThis.navigator?.platform ?? '')
      ? event.metaKey
      : event.ctrlKey;
    if (!platformModifier && !event.shiftKey) return;

    const next = applyTaskSelectionGesture({
      active: selectedItemIds.size > 0,
      anchorId: selectionAnchorId,
      focusedId: focusedItemIdRef.current === DRAFT_ID
        ? null
        : focusedItemIdRef.current,
      selectedIds: selectedItemIds,
    }, {
      taskId: itemId,
      visibleTaskIds: checklist.items.map(({ id }) => id),
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      macLikePlatform: isMacLikePlatform(globalThis.navigator?.platform ?? ''),
      includeFocusedOnActivation: true,
    });
    if (next === null) return;

    event.preventDefault();
    event.stopPropagation();
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement
      && sectionRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
    focusedItemIdRef.current = null;
    setSelectedItemIds(next.selectedIds);
    setSelectionAnchorId(next.anchorId);
  };

  const handleChecklistInputMouseDown = (
    event: ReactMouseEvent<HTMLInputElement>,
  ) => {
    if (
      event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.altKey
      || event.shiftKey
    ) return;
    checklistInputPressRef.current = {
      input: event.currentTarget,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const toggleSelectionFromControl = (itemId: string) => {
    const nextSelectedIds = new Set(selectedItemIds);
    if (nextSelectedIds.has(itemId)) nextSelectedIds.delete(itemId);
    else nextSelectedIds.add(itemId);
    setSelectedItemIds(nextSelectedIds);
    setSelectionAnchorId((current) => {
      if (nextSelectedIds.size === 0) return null;
      if (current !== null && nextSelectedIds.has(current)) return current;
      return nextSelectedIds.has(itemId)
        ? itemId
        : nextSelectedIds.values().next().value ?? null;
    });
  };

  const deleteSelectedItems = useCallback(async () => {
    const selected = checklist.items.filter(({ id }) => selectedItemIds.has(id));
    if (selected.length === 0) {
      clearSelection();
      return;
    }

    const selectedIds = new Set(selected.map(({ id }) => id));
    const firstSelectedIndex = checklist.items.findIndex(({ id }) => selectedIds.has(id));
    const remaining = checklist.items.filter(({ id }) => !selectedIds.has(id));
    const focusCandidate = remaining[
      Math.min(firstSelectedIndex, Math.max(remaining.length - 1, 0))
    ];
    for (const item of selected) cancelScheduledSave(item.id);
    if (draftIndex !== null) {
      const removedBeforeDraft = checklist.items
        .slice(0, draftIndex)
        .filter(({ id }) => selectedIds.has(id))
        .length;
      if (removedBeforeDraft > 0) {
        updateDraftIndex(Math.max(0, draftIndex - removedBeforeDraft));
      }
    }
    clearSelection();
    await checklist.deleteItems(selected.map(({ id }) => id));
    if (focusCandidate) requestInputFocus(focusCandidate.id, 'start');
    else if (draftIndex !== null) requestInputFocus(DRAFT_ID, 'start');
  }, [
    cancelScheduledSave,
    checklist,
    clearSelection,
    draftIndex,
    requestInputFocus,
    selectedItemIds,
    updateDraftIndex,
  ]);

  useEffect(() => {
    const writeSelectedItems = async (
      operation: 'copy' | 'cut',
      event: ClipboardEvent,
    ) => {
      const selected = checklist.items
        .filter(({ id }) => selectedItemIds.has(id))
        .map((item) => ({
          title: editingTitlesRef.current[item.id] ?? item.title,
          completed: normalizeChecklistCompletionForClipboard(item.completed),
        }));
      if (selected.length === 0) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await writeChecklistClipboardRepresentations(
          Promise.resolve(createTaskClipboardRepresentations(
            'checklist-items',
            serializeTaskChecklistClipboard(operation, selected),
            selected.map(({ title }) => title),
          )),
          event,
        );
        if (operation === 'cut') await deleteSelectedItems();
        toast({
          title: operation === 'copy'
            ? 'Checklist Items Copied'
            : 'Checklist Items Cut',
          description: `${selected.length} ${
            selected.length === 1 ? 'checklist item' : 'checklist items'
          } ${operation === 'copy' ? 'copied' : 'cut'}.`,
        });
      } catch (error) {
        showChecklistError(
          operation === 'copy'
            ? 'Checklist Items Could Not Be Copied'
            : 'Checklist Items Could Not Be Cut',
          error,
        );
      }
    };
    const handleCopy = (event: ClipboardEvent) => {
      if (selectedItemIds.size === 0) return;
      void writeSelectedItems('copy', event);
    };
    const handleCut = (event: ClipboardEvent) => {
      if (selectedItemIds.size === 0) return;
      void writeSelectedItems('cut', event);
    };
    window.addEventListener('copy', handleCopy, true);
    window.addEventListener('cut', handleCut, true);
    return () => {
      window.removeEventListener('copy', handleCopy, true);
      window.removeEventListener('cut', handleCut, true);
    };
  }, [checklist.items, deleteSelectedItems, selectedItemIds]);

  useEffect(() => {
    const handleMouseDown = (event: globalThis.MouseEvent) => {
      suppressPostDragClickRef.current = false;
      checklistInputPressRef.current = null;
      const target = event.target;
      if (!(target instanceof Element)) {
        clearSelection();
        return;
      }
      const row = target.closest<HTMLElement>('[data-checklist-item-id]');
      const belongsToEditor = row !== null && sectionRef.current?.contains(row);
      if (belongsToEditor) {
        const platformModifier = isMacLikePlatform(globalThis.navigator?.platform ?? '')
          ? event.metaKey
          : event.ctrlKey;
        if (platformModifier || event.shiftKey) return;
        if (target.closest('[data-checklist-selection-control]')) return;
        const rowId = row.dataset.checklistItemId;
        if (
          rowId !== undefined
          && selectedItemIds.has(rowId)
        ) return;
      }
      clearSelection();
    };
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const press = checklistInputPressRef.current;
      if (press === null) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 4) return;
      suppressPostDragClickRef.current = true;
      checklistInputPressRef.current = null;
      press.input.blur();
    };
    const handleMouseUp = () => {
      checklistInputPressRef.current = null;
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (selectedItemIds.size === 0) return;
      if (
        event.key === 'Escape'
        && !event.metaKey
        && !event.ctrlKey
        && !event.altKey
        && !event.shiftKey
        && !event.isComposing
      ) {
        event.preventDefault();
        event.stopPropagation();
        clearSelection();
        return;
      }
      if (
        (event.key !== 'Delete' && event.key !== 'Backspace')
        || event.isComposing
      ) {
        if (
          event.key.length === 1
          && !event.metaKey
          && !event.ctrlKey
          && !event.altKey
          && !event.isComposing
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      consumeChecklistMutation(
        deleteSelectedItems(),
        'Checklist Items Could Not Be Deleted',
      );
    };
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [clearSelection, deleteSelectedItems, selectedItemIds]);

  const commitChecklistDrop = useCallback(async (destinationIndex: number) => {
    const activeDraggedIds = draggedIdsRef.current;
    if (activeDraggedIds.length === 0 || dropCommitInFlightRef.current) return;
    dropCommitInFlightRef.current = true;
    clearDragState();
    try {
      if (activeDraggedIds[0] === DRAFT_ID) {
        updateDraftIndex(Math.max(0, Math.min(destinationIndex, checklist.items.length)));
      } else {
        await checklist.reorderItems(activeDraggedIds, destinationIndex);
      }
    } catch (error) {
      showChecklistError('Checklist Items Could Not Be Reordered', error);
    } finally {
      dropCommitInFlightRef.current = false;
    }
  }, [checklist, clearDragState, updateDraftIndex]);

  const commitImmediateChecklistDrop = useCallback(() => {
    const destinationIndex = dropIndexRef.current;
    if (destinationIndex === null) {
      clearDragState();
      return;
    }
    void commitChecklistDrop(destinationIndex);
  }, [clearDragState, commitChecklistDrop]);

  const handleDrop = (event: DragEvent, destinationIndex: number) => {
    event.preventDefault();
    void commitChecklistDrop(destinationIndex);
  };

  useEffect(() => {
    if (draggedIds.length === 0) return undefined;

    const isChecklistTarget = (target: EventTarget | null) => (
      target instanceof Node && sectionRef.current?.contains(target)
    );
    const handleDocumentDragOver = (event: globalThis.DragEvent) => {
      if (
        isChecklistTarget(event.target)
        || draggedIdsRef.current.length === 0
        || dropIndexRef.current === null
      ) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    };
    const handleDocumentDrop = (event: globalThis.DragEvent) => {
      const destinationIndex = dropIndexRef.current;
      if (
        isChecklistTarget(event.target)
        || draggedIdsRef.current.length === 0
        || destinationIndex === null
      ) return;
      event.preventDefault();
      void commitChecklistDrop(destinationIndex);
    };

    document.addEventListener('dragover', handleDocumentDragOver, true);
    document.addEventListener('drop', handleDocumentDrop, true);
    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver, true);
      document.removeEventListener('drop', handleDocumentDrop, true);
    };
  }, [commitChecklistDrop, draggedIds.length]);

  const renderDraft = (index: number) => (
    <DraftChecklistRow
      key={DRAFT_ID}
      rowRef={(node) => {
        if (node) rowRefs.current.set(DRAFT_ID, node);
        else rowRefs.current.delete(DRAFT_ID);
      }}
      inputRef={(node) => {
        if (node) inputRefs.current.set(DRAFT_ID, node);
        else inputRefs.current.delete(DRAFT_ID);
      }}
      title={draftTitle}
      showDropBefore={dropIndex === index}
      canJoinPrevious={index > 0}
      canJoinNext={index < checklist.items.length}
      onTitleChange={updateDraftTitle}
      onJoinPrevious={joinDraftPrevious}
      onJoinNext={joinDraftNext}
      onDeleteEmpty={() => {
        updateDraftIndex(null);
        updateDraftTitle('');
      }}
      onReturn={(selectionStart, selectionEnd) => {
        trackDraftMutation(
          splitDraft(index, selectionStart, selectionEnd),
          'Checklist Item Could Not Be Added',
        );
      }}
      onMultilinePaste={(selectionStart, selectionEnd, text) => {
        trackDraftMutation(
          pasteIntoDraft(index, selectionStart, selectionEnd, text),
          'Checklist Items Could Not Be Pasted',
        );
      }}
      onChecklistPaste={(items) => {
        void pasteChecklistItemsAtDraft(index, items);
      }}
      onInvalidChecklistPaste={rejectChecklistPaste}
      onMoveVertical={(direction) => moveInputFocus(DRAFT_ID, direction)}
      onMoveHorizontal={(direction, position) => (
        moveInputFocus(DRAFT_ID, direction, position)
      )}
      onBlur={() => {
        if (!draftTitleRef.current.trim()) {
          if (draggedIdsRef.current.includes(DRAFT_ID)) return;
          updateDraftIndex(null);
          updateDraftTitle('');
          if (focusedItemIdRef.current === DRAFT_ID) {
            focusedItemIdRef.current = null;
          }
          return;
        }
        trackDraftMutation(
          commitDraft({ keepFollowingDraft: false }),
          'Checklist Item Could Not Be Saved',
        );
      }}
      onFocus={() => {
        focusedItemIdRef.current = DRAFT_ID;
      }}
      onInputMouseDown={handleChecklistInputMouseDown}
      onClickCapture={(event) => {
        if (!suppressPostDragClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onDragStart={() => {
        suppressPostDragClickRef.current = true;
        updateDraggedIds([DRAFT_ID]);
      }}
      onDragEnd={clearDragState}
      onDragOver={(event) => {
        event.preventDefault();
        updateDropIndex(index);
      }}
      onDrop={(event) => handleDrop(event, index)}
      showDragHandle={showDragHandles}
      immediateDragScope={immediateDragScope}
      onImmediateDragOver={() => updateDropIndex(index)}
      onImmediateDrop={commitImmediateChecklistDrop}
      onImmediateCancel={clearDragState}
    />
  );

  return (
    <section
      ref={sectionRef}
      aria-label="Checklist"
      data-task-checklist
      data-checklist-selection-active={selectedItemIds.size > 0 ? 'true' : undefined}
      className="space-y-0.5"
      onDragOver={(event) => event.stopPropagation()}
      onDrop={(event) => event.stopPropagation()}
    >
      {checklist.items.map((item, index) => (
        <Fragment key={item.id}>
          {draftIndex === index ? renderDraft(index) : null}
          <ChecklistRow
            item={item}
            title={editingTitles[item.id] ?? item.title}
            selectionActive={selectedItemIds.size > 0}
            selected={selectedItemIds.has(item.id)}
            rowRef={(node) => {
              if (node) rowRefs.current.set(item.id, node);
              else rowRefs.current.delete(item.id);
            }}
            inputRef={(node) => {
              if (node) inputRefs.current.set(item.id, node);
              else inputRefs.current.delete(item.id);
            }}
            showDropBefore={dropIndex === index && draftIndex !== index}
            canJoinPrevious={index > 0 || draftIndex === index}
            canJoinNext={index < checklist.items.length - 1 || draftIndex === index + 1}
            onComplete={async (completed) => {
              if (completed) prepareCompletionAnimation();
              try {
                return await checklist.setCompleted(item, completed);
              } catch (error) {
                pendingCompletionRowTopsRef.current = null;
                throw error;
              }
            }}
            onTitleChange={(title) => {
              setEditingTitle(item.id, title);
              scheduleTitleSave(item, title);
            }}
            onBlur={(title) => {
              consumeChecklistMutation(
                saveTitle(item, title),
                'Checklist Item Could Not Be Saved',
              );
            }}
            onFocus={() => {
              focusedItemIdRef.current = item.id;
            }}
            onInputMouseDown={handleChecklistInputMouseDown}
            onSelectionMouseDown={(event) => handleSelectionMouseDown(event, item.id)}
            onSelectionClick={(event) => {
              if (suppressPostDragClickRef.current) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              const platformModifier = isMacLikePlatform(
                globalThis.navigator?.platform ?? '',
              )
                ? event.metaKey
                : event.ctrlKey;
              if (platformModifier || event.shiftKey) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              if (selectedItemIds.size === 0) return;
              const target = event.target;
              if (
                target instanceof Element
                && target.closest('[data-checklist-selection-control]')
              ) return;
              clearSelection();
              if (!(target instanceof Element)) return;
              if (target.closest('[role="checkbox"]')) return;
              if (target instanceof HTMLInputElement) {
                requestInputFocus(
                  item.id,
                  target.selectionStart ?? target.value.length,
                );
                return;
              }
              requestInputFocus(item.id, 'end');
            }}
            onJoinPrevious={(title) => joinPrevious(item, title, index)}
            onJoinNext={(title) => joinNext(item, title, index)}
            onDeleteEmpty={async () => {
              cancelScheduledSave(item.id);
              await checklist.deleteItem(item.id);
              const next = checklist.items[index + 1];
              if (draftIndex !== null && draftIndex > index) {
                updateDraftIndex(draftIndex - 1);
              }
              if (draftIndex === index || draftIndex === index + 1) {
                requestInputFocus(DRAFT_ID, 'start');
              }
              else if (next) requestInputFocus(next.id, 'start');
            }}
            onAddAfter={(title, selectionStart, selectionEnd) => {
              splitPersistedItem(item, title, index, selectionStart, selectionEnd);
            }}
            onMultilinePaste={(title, selectionStart, selectionEnd, text) => {
              consumeChecklistMutation(pasteIntoPersistedItem(
                item,
                title,
                index,
                selectionStart,
                selectionEnd,
                text,
              ), 'Checklist Items Could Not Be Pasted');
            }}
            onChecklistPaste={(items) => {
              void pasteChecklistItemsAfterPersisted(index, items);
            }}
            onInvalidChecklistPaste={rejectChecklistPaste}
            onMoveVertical={(direction) => moveInputFocus(item.id, direction)}
            onMoveHorizontal={(direction, position) => (
              moveInputFocus(item.id, direction, position)
            )}
            onToggleSelection={() => toggleSelectionFromControl(item.id)}
            onDragStart={() => {
              suppressPostDragClickRef.current = true;
              const movingIds = selectedItemIds.has(item.id)
                ? checklist.items
                    .filter(({ id }) => selectedItemIds.has(id))
                    .map(({ id }) => id)
                : [item.id];
              updateDraggedIds(movingIds);
            }}
            onDragEnd={() => {
              clearDragState();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              updateDropIndex(index);
            }}
            onDrop={(event) => handleDrop(event, index)}
            showDragHandle={showDragHandles}
            immediateDragScope={immediateDragScope}
            onImmediateDragOver={() => updateDropIndex(index)}
            onImmediateDrop={commitImmediateChecklistDrop}
            onImmediateCancel={clearDragState}
          />
        </Fragment>
      ))}
      {draftIndex === checklist.items.length ? renderDraft(checklist.items.length) : null}
      {checklist.items.length > 0 || draftIndex !== null ? (
        <ChecklistEndDropTarget
          scope={showDragHandles ? immediateDragScope : null}
          onImmediateDragOver={() => updateDropIndex(checklist.items.length)}
          onDragOver={(event) => {
            event.preventDefault();
            updateDropIndex(checklist.items.length);
          }}
          onDrop={(event) => handleDrop(event, checklist.items.length)}
        >
          {dropIndex === checklist.items.length && draggedIds.length > 0 ? (
            <div
              data-checklist-drop-indicator
              className="absolute inset-x-0 top-0 h-0.5 bg-info"
              aria-hidden="true"
            />
          ) : null}
        </ChecklistEndDropTarget>
      ) : null}
      {checklist.items.length === 0 && draftIndex === null ? (
        <button
          type="button"
          aria-label="Add Checklist"
          data-task-checklist-disclosure
          className={[
            'inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            emptyActionLayout === 'paired'
              ? 'w-full justify-center'
              : 'w-fit justify-start',
          ].join(' ')}
          onClick={beginChecklist}
        >
          <TASK_ICONS.TaskChecklist className="h-4 w-4" aria-hidden="true" />
          Add Checklist
        </button>
      ) : null}
    </section>
  );
}

function ChecklistRow({
  item,
  title,
  selectionActive,
  selected,
  rowRef,
  inputRef,
  showDropBefore,
  canJoinPrevious,
  canJoinNext,
  onComplete,
  onTitleChange,
  onBlur,
  onFocus,
  onInputMouseDown,
  onSelectionMouseDown,
  onSelectionClick,
  onJoinPrevious,
  onJoinNext,
  onDeleteEmpty,
  onAddAfter,
  onMultilinePaste,
  onChecklistPaste,
  onInvalidChecklistPaste,
  onMoveVertical,
  onMoveHorizontal,
  onToggleSelection,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  showDragHandle,
  immediateDragScope,
  onImmediateDragOver,
  onImmediateDrop,
  onImmediateCancel,
}: {
  item: TaskChecklistEditorItem;
  title: string;
  selectionActive: boolean;
  selected: boolean;
  rowRef: (node: HTMLDivElement | null) => void;
  inputRef: (node: HTMLInputElement | null) => void;
  showDropBefore: boolean;
  canJoinPrevious: boolean;
  canJoinNext: boolean;
  onComplete: (completed: boolean) => Promise<unknown>;
  onTitleChange: (title: string) => void;
  onBlur: (title: string) => void;
  onFocus: () => void;
  onInputMouseDown: (event: ReactMouseEvent<HTMLInputElement>) => void;
  onSelectionMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onSelectionClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onJoinPrevious: (title: string) => Promise<void>;
  onJoinNext: (title: string) => Promise<void>;
  onDeleteEmpty: () => Promise<void>;
  onAddAfter: (title: string, selectionStart: number, selectionEnd: number) => void;
  onMultilinePaste: (
    title: string,
    selectionStart: number,
    selectionEnd: number,
    text: string,
  ) => void;
  onChecklistPaste: (items: readonly TaskChecklistClipboardItem[]) => void;
  onInvalidChecklistPaste: (reason: string) => void;
  onMoveVertical: (direction: -1 | 1) => boolean;
  onMoveHorizontal: (
    direction: -1 | 1,
    position: Extract<CaretPosition, 'start' | 'end'>,
  ) => boolean;
  onToggleSelection: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  showDragHandle: boolean;
  immediateDragScope: string;
  onImmediateDragOver: () => void;
  onImmediateDrop: () => void;
  onImmediateCancel: () => void;
}) {
  const immediateRowRef = useRef<HTMLDivElement>(null);
  const setRowRef = useCallback((node: HTMLDivElement | null) => {
    immediateRowRef.current = node;
    rowRef(node);
  }, [rowRef]);
  const handleImmediateTarget = useCallback(() => {
    onImmediateDragOver();
  }, [onImmediateDragOver]);
  useTaskImmediateDragTarget(
    showDragHandle ? immediateDragScope : null,
    immediateRowRef,
    showDragHandle ? handleImmediateTarget : null,
  );
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onAddAfter(title, selectionStart, selectionEnd);
      return;
    }
    if (
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')
      && onMoveVertical(event.key === 'ArrowUp' ? -1 : 1)
    ) {
      event.preventDefault();
      return;
    }
    if (
      isEligibleHorizontalBoundaryGesture(event)
      && selectionStart === selectionEnd
    ) {
      const crossesLeftBoundary = event.key === 'ArrowLeft' && selectionStart === 0;
      const crossesRightBoundary = (
        event.key === 'ArrowRight'
        && selectionStart === title.length
      );
      if (
        crossesLeftBoundary
        && onMoveHorizontal(-1, 'end')
      ) {
        event.preventDefault();
        return;
      }
      if (
        crossesRightBoundary
        && onMoveHorizontal(1, 'start')
      ) {
        event.preventDefault();
        return;
      }
    }
    if (
      event.key === 'Backspace'
      && selectionStart === 0
      && selectionEnd === 0
    ) {
      if (canJoinPrevious) {
        event.preventDefault();
        consumeChecklistMutation(
          onJoinPrevious(title),
          'Checklist Items Could Not Be Joined',
        );
      } else if (title === '') {
        event.preventDefault();
        consumeChecklistMutation(
          onDeleteEmpty(),
          'Checklist Item Could Not Be Deleted',
        );
      }
      return;
    }
    if (
      event.key === 'Delete'
      && canJoinNext
      && selectionStart === title.length
      && selectionEnd === title.length
    ) {
      event.preventDefault();
      consumeChecklistMutation(
        onJoinNext(title),
        'Checklist Items Could Not Be Joined',
      );
    }
  };

  const handlePaste = (event: ReactClipboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const text = readTaskClipboardStructuredText(
      event.clipboardData,
      'checklist-items',
    ) ?? event.clipboardData.getData('text/plain');
    const parsed = parseTaskChecklistClipboard(text);
    if (parsed.kind === 'invalid-checklist-payload') {
      event.preventDefault();
      event.stopPropagation();
      onInvalidChecklistPaste(parsed.reason);
      return;
    }
    if (parsed.kind === 'checklist-items') {
      event.preventDefault();
      event.stopPropagation();
      onChecklistPaste(parsed.envelope.items);
      return;
    }
    if (parsed.kind !== 'text' || !/[\r\n]/.test(parsed.text)) return;
    event.preventDefault();
    event.stopPropagation();
    onMultilinePaste(
      title,
      input.selectionStart ?? 0,
      input.selectionEnd ?? input.selectionStart ?? 0,
      parsed.text,
    );
  };

  return (
    <div
      ref={setRowRef}
      data-checklist-item-id={item.id}
      data-selected={selected ? 'true' : undefined}
      draggable
      className={`relative flex min-w-0 items-center gap-1 rounded-md ${
        selected ? 'bg-info/20' : ''
      }`}
      onMouseDownCapture={onSelectionMouseDown}
      onClickCapture={onSelectionClick}
      onDragStart={(event) => {
        event.stopPropagation();
        const activeElement = document.activeElement;
        if (
          activeElement instanceof HTMLElement
          && event.currentTarget.contains(activeElement)
        ) {
          activeElement.blur();
        }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(
          'application/x-bathos-checklist-item',
          item.id,
        );
        onDragStart();
      }}
      onDragEnd={(event) => {
        event.stopPropagation();
        onDragEnd();
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {showDropBefore ? (
        <span
          data-checklist-drop-indicator
          className="absolute inset-x-0 -top-0.5 h-0.5 bg-info"
          aria-hidden="true"
        />
      ) : null}
      {selectionActive ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`${selected ? 'Deselect' : 'Select'} ${item.title}`}
          data-checklist-selection-control
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-info transition-colors  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onToggleSelection}
        >
          {selected ? (
            <TASK_ICONS.Selected className="h-4 w-4" aria-hidden="true" />
          ) : (
            <TASK_ICONS.Selection className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={item.completed}
          aria-label={`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            consumeChecklistMutation(
              onComplete(!item.completed),
              'Checklist Item Could Not Be Updated',
            );
          }}
        >
          {item.completed ? (
            <TASK_ICONS.CompletedTask className="h-4 w-4" aria-hidden="true" />
          ) : (
            <TASK_ICONS.OpenTask className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      )}
      <Input
        ref={inputRef}
        value={title}
        draggable
        aria-label="Checklist Item"
        placeholder="Item"
        data-bathos-field-return-owned="true"
        className={`h-8 px-2 py-1 ${
          item.completed ? 'text-muted-foreground line-through' : ''
        } ${selected ? 'border-transparent bg-transparent' : ''}`}
        onChange={(event) => onTitleChange(event.target.value)}
        onBlur={() => onBlur(title)}
        onFocus={onFocus}
        onMouseDown={onInputMouseDown}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
      {showDragHandle ? (
        <TaskImmediateDragHandle
          label={`Reorder ${title || 'Checklist Item'}`}
          scope={immediateDragScope}
          previewRef={immediateRowRef}
          onStart={onDragStart}
          onDrop={onImmediateDrop}
          onCancel={onImmediateCancel}
        />
      ) : null}
    </div>
  );
}

function DraftChecklistRow({
  title,
  rowRef,
  inputRef,
  showDropBefore,
  canJoinPrevious,
  canJoinNext,
  onTitleChange,
  onJoinPrevious,
  onJoinNext,
  onDeleteEmpty,
  onReturn,
  onMultilinePaste,
  onChecklistPaste,
  onInvalidChecklistPaste,
  onMoveVertical,
  onMoveHorizontal,
  onBlur,
  onFocus,
  onInputMouseDown,
  onClickCapture,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  showDragHandle,
  immediateDragScope,
  onImmediateDragOver,
  onImmediateDrop,
  onImmediateCancel,
}: {
  title: string;
  rowRef: (node: HTMLDivElement | null) => void;
  inputRef: (node: HTMLInputElement | null) => void;
  showDropBefore: boolean;
  canJoinPrevious: boolean;
  canJoinNext: boolean;
  onTitleChange: (title: string) => void;
  onJoinPrevious: () => Promise<void>;
  onJoinNext: () => Promise<void>;
  onDeleteEmpty: () => void;
  onReturn: (selectionStart: number, selectionEnd: number) => void;
  onMultilinePaste: (
    selectionStart: number,
    selectionEnd: number,
    text: string,
  ) => void;
  onChecklistPaste: (items: readonly TaskChecklistClipboardItem[]) => void;
  onInvalidChecklistPaste: (reason: string) => void;
  onMoveVertical: (direction: -1 | 1) => boolean;
  onMoveHorizontal: (
    direction: -1 | 1,
    position: Extract<CaretPosition, 'start' | 'end'>,
  ) => boolean;
  onBlur: () => void;
  onFocus: () => void;
  onInputMouseDown: (event: ReactMouseEvent<HTMLInputElement>) => void;
  onClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  showDragHandle: boolean;
  immediateDragScope: string;
  onImmediateDragOver: () => void;
  onImmediateDrop: () => void;
  onImmediateCancel: () => void;
}) {
  const immediateRowRef = useRef<HTMLDivElement>(null);
  const setRowRef = useCallback((node: HTMLDivElement | null) => {
    immediateRowRef.current = node;
    rowRef(node);
  }, [rowRef]);
  const handleImmediateTarget = useCallback(() => {
    onImmediateDragOver();
  }, [onImmediateDragOver]);
  useTaskImmediateDragTarget(
    showDragHandle ? immediateDragScope : null,
    immediateRowRef,
    showDragHandle ? handleImmediateTarget : null,
  );
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onReturn(selectionStart, selectionEnd);
      return;
    }
    if (
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')
      && onMoveVertical(event.key === 'ArrowUp' ? -1 : 1)
    ) {
      event.preventDefault();
      return;
    }
    if (
      isEligibleHorizontalBoundaryGesture(event)
      && selectionStart === selectionEnd
    ) {
      const crossesLeftBoundary = event.key === 'ArrowLeft' && selectionStart === 0;
      const crossesRightBoundary = (
        event.key === 'ArrowRight'
        && selectionStart === title.length
      );
      if (
        crossesLeftBoundary
        && onMoveHorizontal(-1, 'end')
      ) {
        event.preventDefault();
        return;
      }
      if (
        crossesRightBoundary
        && onMoveHorizontal(1, 'start')
      ) {
        event.preventDefault();
        return;
      }
    }
    if (
      event.key === 'Backspace'
      && selectionStart === 0
      && selectionEnd === 0
    ) {
      if (canJoinPrevious) {
        event.preventDefault();
        consumeChecklistMutation(
          onJoinPrevious(),
          'Checklist Items Could Not Be Joined',
        );
      } else if (title === '') {
        event.preventDefault();
        onDeleteEmpty();
      }
      return;
    }
    if (
      event.key === 'Delete'
      && canJoinNext
      && selectionStart === title.length
      && selectionEnd === title.length
    ) {
      event.preventDefault();
      consumeChecklistMutation(
        onJoinNext(),
        'Checklist Items Could Not Be Joined',
      );
    }
  };

  const handlePaste = (event: ReactClipboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const text = readTaskClipboardStructuredText(
      event.clipboardData,
      'checklist-items',
    ) ?? event.clipboardData.getData('text/plain');
    const parsed = parseTaskChecklistClipboard(text);
    if (parsed.kind === 'invalid-checklist-payload') {
      event.preventDefault();
      event.stopPropagation();
      onInvalidChecklistPaste(parsed.reason);
      return;
    }
    if (parsed.kind === 'checklist-items') {
      event.preventDefault();
      event.stopPropagation();
      onChecklistPaste(parsed.envelope.items);
      return;
    }
    if (parsed.kind !== 'text' || !/[\r\n]/.test(parsed.text)) return;
    event.preventDefault();
    event.stopPropagation();
    onMultilinePaste(
      input.selectionStart ?? 0,
      input.selectionEnd ?? input.selectionStart ?? 0,
      parsed.text,
    );
  };

  return (
    <div
      ref={setRowRef}
      data-checklist-item-id={DRAFT_ID}
      draggable
      className="relative flex min-w-0 items-center gap-1"
      onClickCapture={onClickCapture}
      onDragStart={(event) => {
        event.stopPropagation();
        onDragStart();
        const activeElement = document.activeElement;
        if (
          activeElement instanceof HTMLElement
          && event.currentTarget.contains(activeElement)
        ) {
          activeElement.blur();
        }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(
          'application/x-bathos-checklist-item',
          DRAFT_ID,
        );
      }}
      onDragEnd={(event) => {
        event.stopPropagation();
        onDragEnd();
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {showDropBefore ? (
        <span
          data-checklist-drop-indicator
          className="absolute inset-x-0 -top-0.5 h-0.5 bg-info"
          aria-hidden="true"
        />
      ) : null}
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground">
        <TASK_ICONS.OpenTask className="h-4 w-4" aria-hidden="true" />
      </span>
      <Input
        ref={inputRef}
        value={title}
        draggable
        aria-label="New Checklist Item"
        placeholder="Item"
        data-bathos-field-return-owned="true"
        className="h-8 px-2 py-1"
        onChange={(event) => onTitleChange(event.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        onMouseDown={onInputMouseDown}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
      {showDragHandle ? (
        <TaskImmediateDragHandle
          label="Reorder New Checklist Item"
          scope={immediateDragScope}
          previewRef={immediateRowRef}
          onStart={onDragStart}
          onDrop={onImmediateDrop}
          onCancel={onImmediateCancel}
        />
      ) : null}
    </div>
  );
}

function ChecklistEndDropTarget({
  scope,
  onImmediateDragOver,
  onDragOver,
  onDrop,
  children,
}: {
  scope: string | null;
  onImmediateDragOver: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const handleImmediateTarget = useCallback(() => {
    onImmediateDragOver();
  }, [onImmediateDragOver]);
  useTaskImmediateDragTarget(scope, targetRef, scope ? handleImmediateTarget : null);
  return (
    <div
      ref={targetRef}
      className="relative h-1.5"
      data-checklist-drop-end
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}

async function writeChecklistClipboardRepresentations(
  representationsPromise: Promise<TaskClipboardRepresentations>,
  event: ClipboardEvent,
): Promise<void> {
  if (
    typeof ClipboardItem !== 'undefined'
    && globalThis.navigator?.clipboard?.write
  ) {
    const clipboardItemData: Record<string, Promise<Blob>> = {
      'text/plain': representationsPromise.then(({ plainText }) => (
        new Blob([plainText], { type: 'text/plain' })
      )),
      'text/html': representationsPromise.then(({ html }) => (
        new Blob([html], { type: 'text/html' })
      )),
    };
    if (
      typeof ClipboardItem.supports === 'function'
      && ClipboardItem.supports(TASK_CHECKLIST_CLIPBOARD_WEB_MIME_TYPE)
    ) {
      clipboardItemData[TASK_CHECKLIST_CLIPBOARD_WEB_MIME_TYPE] =
        representationsPromise.then(({ structuredText }) => new Blob(
          [structuredText],
          { type: TASK_CHECKLIST_CLIPBOARD_MIME_TYPE },
        ));
    }
    const item = new ClipboardItem(clipboardItemData);
    await globalThis.navigator.clipboard.write([item]);
    return;
  }
  const representations = await representationsPromise;
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', representations.plainText);
    event.clipboardData.setData('text/html', representations.html);
    event.clipboardData.setData(
      TASK_CHECKLIST_CLIPBOARD_MIME_TYPE,
      representations.structuredText,
    );
    return;
  }
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(representations.structuredText);
    return;
  }
  throw new Error('The browser clipboard is unavailable');
}

function showChecklistError(title: string, error: unknown): void {
  toast({
    title,
    description: error instanceof Error ? error.message : 'Unknown error',
    variant: 'destructive',
  });
}

function consumeChecklistMutation(
  mutation: Promise<unknown>,
  failureTitle: string,
): void {
  void mutation.catch((error) => {
    showChecklistError(failureTitle, error);
  });
}

function normalizeChecklistCompletionForClipboard(completed: unknown): boolean {
  if (completed === true || completed === 1) return true;
  if (completed === false || completed === 0) return false;
  throw new Error('Checklist clipboard completion state is invalid');
}
