import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { GripVertical } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import { useTaskChecklist } from '@/modules/tasks/hooks/useTaskChecklist';
import type { TaskChecklistItem } from '@/modules/tasks/types/tasks';

const AUTOSAVE_DELAY_MS = 350;

export function TaskChecklistEditor({
  ownerId,
  taskId,
  focusRequestTaskId = taskId,
}: {
  ownerId: string;
  taskId: string;
  focusRequestTaskId?: string;
}) {
  const checklist = useTaskChecklist(ownerId, taskId);
  const [draftVisible, setDraftVisible] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const draftTitlesRef = useRef(new Map<string, string>());
  const previousRowTops = useRef(new Map<string, number>());
  const itemsRef = useRef(checklist.items);
  const deleteItemRef = useRef(checklist.deleteItem);
  itemsRef.current = checklist.items;
  deleteItemRef.current = checklist.deleteItem;

  const focusItem = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const input = inputRefs.current.get(id);
      input?.focus({ preventScroll: true });
      input?.setSelectionRange(input.value.length, input.value.length);
    });
  }, []);

  const recordDraftTitle = useCallback((itemId: string, title: string) => {
    draftTitlesRef.current.set(itemId, title);
  }, []);

  const beginChecklist = useCallback(() => {
    const first = checklist.items[0];
    if (first) {
      focusItem(first.id);
      return;
    }
    setDraftVisible(true);
    requestAnimationFrame(() => focusItem('draft'));
  }, [checklist.items, focusItem]);

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

  useEffect(() => () => {
    for (const item of itemsRef.current) {
      const value = draftTitlesRef.current.get(item.id)?.trim() ?? item.title.trim();
      if (value === '') void deleteItemRef.current(item.id);
    }
  }, []);

  useLayoutEffect(() => {
    const nextTops = new Map<string, number>();
    for (const [id, row] of rowRefs.current) {
      const top = row.getBoundingClientRect().top;
      nextTops.set(id, top);
      const previousTop = previousRowTops.current.get(id);
      if (previousTop === undefined || previousTop === top) continue;
      row.animate(
        [
          { transform: `translateY(${previousTop - top}px)` },
          { transform: 'translateY(0)' },
        ],
        { duration: 220, easing: 'ease-out' },
      );
    }
    previousRowTops.current = nextTops;
  }, [checklist.items]);

  const commitDraft = async (value: string) => {
    const title = value.trim();
    if (!title) return null;
    const item = await checklist.createItem(title);
    setDraftTitle('');
    setDraftVisible(false);
    focusItem(item.id);
    return item;
  };

  const addAfter = async (item: TaskChecklistItem) => {
    const currentValue = inputRefs.current.get(item.id)?.value ?? item.title;
    if (currentValue.trim() && currentValue.trim() !== item.title) {
      await checklist.updateItem(item.id, { title: currentValue.trim() });
    }
    setDraftVisible(true);
    setDraftTitle('');
    requestAnimationFrame(() => focusItem('draft'));
  };

  const handleDrop = async (event: DragEvent, destinationIndex: number) => {
    event.preventDefault();
    if (!draggedId) return;
    const currentIndex = checklist.items.findIndex(({ id }) => id === draggedId);
    const adjustedIndex = currentIndex >= 0 && destinationIndex > currentIndex
      ? destinationIndex - 1
      : destinationIndex;
    if (adjustedIndex !== currentIndex) {
      await checklist.reorderItem(draggedId, adjustedIndex);
    }
    setDraggedId(null);
    setDropIndex(null);
  };

  return (
    <section
      aria-label="Checklist"
      data-task-checklist
      className="space-y-1"
    >
      {checklist.items.map((item, index) => (
        <ChecklistRow
          key={item.id}
          item={item}
          rowRef={(node) => {
            if (node) rowRefs.current.set(item.id, node);
            else rowRefs.current.delete(item.id);
          }}
          inputRef={(node) => {
            if (node) inputRefs.current.set(item.id, node);
            else inputRefs.current.delete(item.id);
          }}
          showDropBefore={dropIndex === index}
          onComplete={(completed) => checklist.setCompleted(item, completed)}
          onUpdate={(title) => checklist.updateItem(item.id, { title })}
          onDraftTitleChange={recordDraftTitle}
          onDelete={async () => {
            const previous = checklist.items[index - 1] ?? null;
            await checklist.deleteItem(item.id);
            if (previous) focusItem(previous.id);
          }}
          onAddAfter={() => addAfter(item)}
          onDragStart={() => setDraggedId(item.id)}
          onDragEnd={() => {
            setDraggedId(null);
            setDropIndex(null);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDropIndex(index);
          }}
          onDrop={(event) => void handleDrop(event, index)}
        />
      ))}
      {checklist.items.length > 0 ? (
        <div
          className="relative h-2"
          data-checklist-drop-end
          onDragOver={(event) => {
            event.preventDefault();
            setDropIndex(checklist.items.length);
          }}
          onDrop={(event) => void handleDrop(event, checklist.items.length)}
        >
          {dropIndex === checklist.items.length && draggedId ? (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-info" aria-hidden="true" />
          ) : null}
        </div>
      ) : null}
      {draftVisible ? (
        <div className="flex min-w-0 items-center gap-1">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground">
            <TASK_ICONS.OpenTask className="h-5 w-5" aria-hidden="true" />
          </span>
          <Input
            ref={(node) => {
              if (node) inputRefs.current.set('draft', node);
              else inputRefs.current.delete('draft');
            }}
            value={draftTitle}
            aria-label="New Checklist Item"
            placeholder="Checklist Item"
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={() => {
              if (draftTitle.trim()) void commitDraft(draftTitle);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void commitDraft(draftTitle).then(() => {
                  setDraftVisible(true);
                  requestAnimationFrame(() => focusItem('draft'));
                });
              } else if (event.key === 'Backspace' && draftTitle === '') {
                event.preventDefault();
                setDraftVisible(false);
                const previous = checklist.items.at(-1);
                if (previous) focusItem(previous.id);
              }
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          aria-label={checklist.items.length === 0 ? 'Add Checklist' : 'Add Checklist Item'}
          className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={beginChecklist}
        >
          <TASK_ICONS.TaskChecklist className="h-4 w-4" aria-hidden="true" />
          {checklist.items.length === 0 ? 'Add Checklist' : 'Add Checklist Item'}
        </button>
      )}
    </section>
  );
}

function ChecklistRow({
  item,
  rowRef,
  inputRef,
  showDropBefore,
  onComplete,
  onUpdate,
  onDraftTitleChange,
  onDelete,
  onAddAfter,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  item: TaskChecklistItem;
  rowRef: (node: HTMLDivElement | null) => void;
  inputRef: (node: HTMLInputElement | null) => void;
  showDropBefore: boolean;
  onComplete: (completed: boolean) => Promise<unknown>;
  onUpdate: (title: string) => Promise<unknown>;
  onDraftTitleChange: (itemId: string, title: string) => void;
  onDelete: () => Promise<void>;
  onAddAfter: () => Promise<void>;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    setTitle(item.title);
    onDraftTitleChange(item.id, item.title);
  }, [item.id, item.title, onDraftTitleChange]);
  useLayoutEffect(() => () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
  }, []);

  const scheduleSave = (nextTitle: string) => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    if (!nextTitle.trim()) return;
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void onUpdate(nextTitle.trim());
    }, AUTOSAVE_DELAY_MS);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void onAddAfter();
      return;
    }
    if (event.key === 'Backspace' && title === '') {
      event.preventDefault();
      void onDelete();
    }
  };

  return (
    <div
      ref={rowRef}
      className="relative flex min-w-0 items-center gap-1 transition-transform duration-200 ease-out"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {showDropBefore ? (
        <span className="absolute inset-x-0 -top-0.5 h-0.5 bg-info" aria-hidden="true" />
      ) : null}
      <button
        type="button"
        role="checkbox"
        aria-checked={item.completed}
        aria-label={`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => void onComplete(!item.completed)}
      >
        {item.completed ? (
          <TASK_ICONS.CompletedTask className="h-5 w-5 text-success" aria-hidden="true" />
        ) : (
          <TASK_ICONS.OpenTask className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
      <Input
        ref={inputRef}
        value={title}
        aria-label="Checklist Item"
        className={item.completed ? 'text-muted-foreground line-through' : undefined}
        onChange={(event) => {
          setTitle(event.target.value);
          onDraftTitleChange(item.id, event.target.value);
          scheduleSave(event.target.value);
        }}
        onBlur={() => {
          const normalized = title.trim();
          if (normalized && normalized !== item.title) void onUpdate(normalized);
        }}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        draggable
        aria-label={`Reorder ${item.title}`}
        className="inline-flex h-9 w-8 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('application/x-bathos-checklist-item', item.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
