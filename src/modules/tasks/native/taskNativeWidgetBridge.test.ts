import {
  taskAreaFixture,
  taskRecurrenceDefinitionFixture,
  taskRecurrenceRevisionFixture,
  taskTodoFixture,
} from '@/modules/tasks/testing/taskFixtures';

import {
  buildTaskNativeWidgetSnapshot,
  clearTaskNativeQuickEntryShortcut,
  clearTaskNativeWidgetCache,
  configureTaskNativeQuickEntryShortcut,
  finishTaskNativeQuickEntry,
  getNativeNewTaskSignal,
  getNativeTaskDeepLinkId,
  hasNativeNewTaskSignal,
  isTaskNativeQuickEntry,
  publishTaskNativeContentReady,
  publishTaskNativeQuickEntryReady,
  publishTaskNativeWidgetSnapshot,
  publishTaskNativeWidgetCredential,
  requestTaskNativeQuickEntryDismissal,
  requestTaskNativeNewTaskSummaryFocus,
  removeNativeNewTaskSignal,
  removeNativeTaskDeepLink,
  resetTaskNativeWidgetPublisherForTests,
} from './taskNativeWidgetBridge';

const ownerId = '00000000-0000-4000-8000-000000000001';
const taskA = '10000000-0000-4000-8000-000000000001';
const taskB = '10000000-0000-4000-8000-000000000002';
const taskC = '10000000-0000-4000-8000-000000000003';

function bridgeWindow(messages: unknown[], schemaVersion: 1 | 2 = 2): Window {
  return {
    ...(schemaVersion === 2
      ? {
        __bathosTasksNative: {
          schemaVersion: 2,
          installationId: '30000000-0000-4000-8000-000000000001',
        },
      }
      : {}),
    webkit: {
      messageHandlers: {
        bathosTasksWidget: {
          postMessage: (message: unknown) => messages.push(message),
        },
      },
    },
  } as unknown as Window;
}

describe('taskNativeWidgetBridge', () => {
  beforeEach(() => {
    resetTaskNativeWidgetPublisherForTests();
  });

  it('derives all supported owner-scoped views without private task fields', () => {
    const snapshot = buildTaskNativeWidgetSnapshot({
      ownerId,
      planningDate: '2026-07-27',
      generatedAt: '2026-07-27T12:00:00.000Z',
      quickFilter: 'all',
      automaticListSorting: false,
      areas: [],
      tasks: [
        taskTodoFixture({
          id: taskA,
          owner_id: ownerId,
          title: 'Today Task',
          notes: 'Private Notes',
          primary_link: 'https://private.example',
          today_section: 'inbox',
        }),
        taskTodoFixture({
          id: taskB,
          owner_id: ownerId,
          title: 'Upcoming Task',
          start_date: '2026-07-28',
          today_section: null,
        }),
        taskTodoFixture({
          id: taskC,
          owner_id: ownerId,
          title: 'Someday Task',
          destination: 'someday',
          today_section: null,
        }),
        taskTodoFixture({
          id: '10000000-0000-4000-8000-000000000004',
          owner_id: 'other-owner',
          title: 'Other Owner',
        }),
      ],
    });

    expect(snapshot.lists.map(({ id }) => id)).toEqual([
      'today',
      'upcoming',
      'anytime',
      'someday',
      'done',
    ]);
    expect(snapshot.lists.find(({ id }) => id === 'today')?.tasks).toEqual([
      expect.objectContaining({
        id: taskA,
        summary: 'Today Task',
        todaySection: 'inbox',
        upcomingDate: null,
        isRecurrenceProjection: false,
      }),
    ]);
    expect(snapshot.lists.find(({ id }) => id === 'upcoming')?.tasks).toEqual([
      expect.objectContaining({
        id: taskB,
        upcomingDate: '2026-07-28',
        isRecurrenceProjection: false,
      }),
    ]);
    expect(snapshot.lists.find(({ id }) => id === 'someday')?.tasks).toEqual([
      expect.objectContaining({ id: taskC }),
    ]);
    expect(JSON.stringify(snapshot)).not.toContain('Private Notes');
    expect(snapshot.lists.find(({ id }) => id === 'today')?.tasks[0]?.primaryLink)
      .toEqual({ href: 'https://private.example', kind: 'link' });
    expect(JSON.stringify(snapshot)).not.toContain('Other Owner');
  });

  it('shows first-class recurrence prototypes separately from ordinary Upcoming tasks', () => {
    const recurrenceId = '40000000-0000-4000-8000-000000000001';
    const snapshot = buildTaskNativeWidgetSnapshot({
      ownerId,
      planningDate: '2026-07-27',
      generatedAt: '2026-07-27T12:00:00.000Z',
      quickFilter: 'all',
      automaticListSorting: false,
      areas: [],
      recurrencePrototypes: [{
        definition: taskRecurrenceDefinitionFixture({
          id: recurrenceId,
          owner_id: ownerId,
          name: 'Repeating Prototype',
          next_occurrence_date: '2026-08-31',
        }),
        revision: taskRecurrenceRevisionFixture({
          recurrence_id: recurrenceId,
          name: 'Repeating Prototype',
          prototype_snapshot: {
            version: 2,
            kind: 'todo',
            root: {
              node_id: 'prototype-node-a',
              title: 'Repeating Prototype',
              notes: '',
              primary_link: null,
              actionability: 'actionable',
              destination: 'anytime',
              today_section: null,
              order_key: 'a0',
              start_offset_days: 0,
              deadline_offset_days: null,
              checklist: [],
            },
          },
        }),
        scheduledDate: '2026-08-31',
      }],
      tasks: [
        taskTodoFixture({
          id: taskA,
          owner_id: ownerId,
          title: 'Deadline-only Upcoming Task',
          start_date: null,
          deadline: '2026-08-01',
          today_section: null,
        }),
        taskTodoFixture({
          id: taskB,
          owner_id: ownerId,
          title: 'Deferred Repeating Instance',
          start_date: '2026-08-30',
          today_section: null,
          recurrence_definition_id: recurrenceId,
          recurrence_revision: 1,
          recurrence_occurrence_id: '50000000-0000-4000-8000-000000000001',
          recurrence_logical_key: 'calendar:2026-08-31',
        }),
      ],
    });

    expect(snapshot.lists.find(({ id }) => id === 'upcoming')?.tasks).toEqual([
      expect.objectContaining({
        id: taskA,
        upcomingDate: '2026-08-01',
        isRecurrenceProjection: false,
      }),
      expect.objectContaining({
        id: taskB,
        upcomingDate: '2026-08-30',
        isRecurrenceProjection: false,
      }),
      expect.objectContaining({
        id: recurrenceId,
        summary: 'Repeating Prototype',
        upcomingDate: '2026-08-31',
        isRecurrenceProjection: true,
      }),
    ]);
  });

  it('uses the dedicated mixed Upcoming rank within a shared visible date bucket', () => {
    const recurrenceId = '40000000-0000-4000-8000-000000000099';
    const snapshot = buildTaskNativeWidgetSnapshot({
      ownerId,
      planningDate: '2026-07-27',
      generatedAt: '2026-07-27T12:00:00.000Z',
      quickFilter: 'all',
      automaticListSorting: false,
      areas: [],
      tasks: [
        taskTodoFixture({
          id: taskA, owner_id: ownerId, title: 'Last',
          start_date: '2026-08-31', upcoming_order_key: 'a2',
        }),
        taskTodoFixture({
          id: taskB, owner_id: ownerId, title: 'First',
          start_date: '2026-08-15', upcoming_order_key: 'a0',
        }),
      ],
      recurrencePrototypes: [{
        definition: taskRecurrenceDefinitionFixture({
          id: recurrenceId,
          owner_id: ownerId,
          next_occurrence_date: '2026-08-20',
          upcoming_order_key: 'a1',
        }),
        revision: taskRecurrenceRevisionFixture({ recurrence_id: recurrenceId }),
        scheduledDate: '2026-08-20',
      }],
    });

    expect(snapshot.lists.find(({ id }) => id === 'upcoming')?.tasks.map(({ id }) => id))
      .toEqual([taskB, recurrenceId, taskA]);
  });

  it('keeps a reached recurrence instance ordinary when its Deadline still shows in Upcoming', () => {
    const recurrenceId = '40000000-0000-4000-8000-000000000002';
    const snapshot = buildTaskNativeWidgetSnapshot({
      ownerId,
      planningDate: '2026-07-27',
      generatedAt: '2026-07-27T12:00:00.000Z',
      quickFilter: 'all',
      automaticListSorting: false,
      areas: [],
      tasks: [
        taskTodoFixture({
          id: taskA,
          owner_id: ownerId,
          title: 'Reached Repeating Instance',
          start_date: '2026-07-27',
          deadline: '2026-08-01',
          today_section: 'inbox',
          recurrence_definition_id: recurrenceId,
          recurrence_revision: 1,
          recurrence_occurrence_id: '50000000-0000-4000-8000-000000000002',
          recurrence_logical_key: 'calendar:2026-07-27',
        }),
      ],
    });

    expect(snapshot.lists.find(({ id }) => id === 'upcoming')?.tasks).toEqual([
      expect.objectContaining({
        id: taskA,
        isRecurrenceProjection: false,
      }),
    ]);
  });

  it('normalizes only supported Primary Link protocols for native widget actions', () => {
    const snapshot = buildTaskNativeWidgetSnapshot({
      ownerId,
      planningDate: '2026-07-27',
      quickFilter: 'all',
      automaticListSorting: false,
      areas: [],
      tasks: [
        taskTodoFixture({ id: taskA, owner_id: ownerId, primary_link: 'message://mail-a' }),
        taskTodoFixture({ id: taskB, owner_id: ownerId, primary_link: 'example.test/read' }),
        taskTodoFixture({
          id: taskC,
          owner_id: ownerId,
          primary_link: 'obsidian://open?vault=Personal&file=Tasks',
        }),
      ],
    });
    const tasks = snapshot.lists.find(({ id }) => id === 'anytime')?.tasks;
    expect(tasks?.find(({ id }) => id === taskA)?.primaryLink)
      .toEqual({ href: 'message://mail-a', kind: 'mail' });
    expect(tasks?.find(({ id }) => id === taskB)?.primaryLink)
      .toEqual({ href: 'https://example.test/read', kind: 'link' });
    expect(tasks?.find(({ id }) => id === taskC)?.primaryLink)
      .toEqual({
        href: 'obsidian://open?vault=Personal&file=Tasks',
        kind: 'link',
      });
  });

  it('flattens areas in configured order and applies automatic ordering inside them', () => {
    const areaA = taskAreaFixture({
      id: '20000000-0000-4000-8000-000000000001',
      owner_id: ownerId,
      order_key: 'a0',
    });
    const areaB = taskAreaFixture({
      id: '20000000-0000-4000-8000-000000000002',
      owner_id: ownerId,
      order_key: 'b0',
    });
    const snapshot = buildTaskNativeWidgetSnapshot({
      ownerId,
      planningDate: '2026-07-27',
      quickFilter: 'all',
      automaticListSorting: true,
      areas: [areaB, areaA],
      tasks: [
        taskTodoFixture({
          id: taskA,
          owner_id: ownerId,
          area_id: areaB.id,
          title: 'Area B',
          deadline: null,
        }),
        taskTodoFixture({
          id: taskB,
          owner_id: ownerId,
          area_id: areaA.id,
          title: 'Later Deadline',
          deadline: '2026-07-30',
        }),
        taskTodoFixture({
          id: taskC,
          owner_id: ownerId,
          area_id: areaA.id,
          title: 'Earlier Deadline',
          deadline: '2026-07-28',
        }),
      ],
    });

    expect(snapshot.lists.find(({ id }) => id === 'anytime')?.tasks.map(({ id }) => id))
      .toEqual([taskC, taskB, taskA]);
  });

  it('applies the durable quick filter and bounds every list', () => {
    const snapshot = buildTaskNativeWidgetSnapshot({
      ownerId,
      planningDate: '2026-07-27',
      quickFilter: 'waiting',
      automaticListSorting: false,
      areas: [],
      listLimit: 1,
      tasks: [
        taskTodoFixture({
          id: taskA,
          owner_id: ownerId,
          title: 'Waiting One',
          actionability: 'waiting',
        }),
        taskTodoFixture({
          id: taskB,
          owner_id: ownerId,
          title: 'Waiting Two',
          actionability: 'waiting',
          order_key: 'b0',
        }),
        taskTodoFixture({
          id: taskC,
          owner_id: ownerId,
          title: 'Ready',
          actionability: 'actionable',
        }),
      ],
    });
    const anytime = snapshot.lists.find(({ id }) => id === 'anytime');

    expect(anytime).toMatchObject({
      totalCount: 2,
      truncated: true,
    });
    expect(anytime?.tasks).toHaveLength(1);
  });

  it('publishes only through a detected bridge and suppresses unchanged content', () => {
    const messages: unknown[] = [];
    const snapshot = buildTaskNativeWidgetSnapshot({
      ownerId,
      planningDate: '2026-07-27',
      generatedAt: '2026-07-27T12:00:00.000Z',
      quickFilter: 'all',
      automaticListSorting: false,
      areas: [],
      tasks: [],
    });

    expect(publishTaskNativeWidgetSnapshot(snapshot, {} as Window)).toBe(false);
    expect(publishTaskNativeWidgetSnapshot(snapshot, bridgeWindow(messages))).toBe(true);
    expect(publishTaskNativeWidgetSnapshot({
      ...snapshot,
      generatedAt: '2026-07-27T12:01:00.000Z',
    }, bridgeWindow(messages))).toBe(false);
    expect(messages).toEqual([snapshot]);
  });

  it('keeps the schema-one snapshot and clear contract during a native rollout', () => {
    const messages: unknown[] = [];
    const target = bridgeWindow(messages, 1);
    const snapshot = buildTaskNativeWidgetSnapshot({
      ownerId,
      planningDate: '2026-07-27',
      quickFilter: 'all',
      automaticListSorting: false,
      areas: [],
      tasks: [
        taskTodoFixture({
          id: taskA,
          owner_id: ownerId,
          primary_link: 'https://example.test/read',
        }),
      ],
    });

    expect(publishTaskNativeWidgetSnapshot(snapshot, target)).toBe(true);
    expect(clearTaskNativeWidgetCache(target)).toBe(true);
    expect(messages[0]).toMatchObject({ type: 'snapshot', schemaVersion: 1 });
    expect(JSON.stringify(messages[0])).not.toContain('primaryLink');
    expect(JSON.stringify(messages[0])).not.toContain('upcomingDate');
    expect(JSON.stringify(messages[0])).not.toContain('isRecurrenceProjection');
    expect(messages[1]).toEqual({ type: 'clear', schemaVersion: 1 });
  });

  it('clears through the bridge and allows the same content to publish again', () => {
    const messages: unknown[] = [];
    const target = bridgeWindow(messages);
    const snapshot = buildTaskNativeWidgetSnapshot({
      ownerId,
      planningDate: '2026-07-27',
      quickFilter: 'all',
      automaticListSorting: false,
      areas: [],
      tasks: [],
    });

    publishTaskNativeWidgetSnapshot(snapshot, target);
    expect(clearTaskNativeWidgetCache(target)).toBe(true);
    expect(publishTaskNativeWidgetSnapshot(snapshot, target)).toBe(true);
    expect(messages.map((message) => (message as { type: string }).type))
      .toEqual(['snapshot', 'clear', 'snapshot']);
  });

  it('publishes a credential only through the trusted native bridge', () => {
    const messages: unknown[] = [];
    const message = {
      ownerId,
      installationId: '30000000-0000-4000-8000-000000000001',
      credential: `twc_${'A'.repeat(43)}`,
      expiresAt: '2026-10-26T12:00:00.000Z',
    };
    expect(publishTaskNativeWidgetCredential(message, {} as Window)).toBe(false);
    expect(publishTaskNativeWidgetCredential(message, bridgeWindow(messages))).toBe(true);
    expect(messages).toEqual([expect.objectContaining({
      type: 'credential',
      schemaVersion: 2,
      ...message,
    })]);
  });

  it('requests native Summary focus only from the current companion bridge', () => {
    const messages: unknown[] = [];

    expect(requestTaskNativeNewTaskSummaryFocus({} as Window)).toBe(false);
    expect(requestTaskNativeNewTaskSummaryFocus(bridgeWindow(messages, 1))).toBe(false);
    expect(requestTaskNativeNewTaskSummaryFocus(bridgeWindow(messages))).toBe(true);
    expect(messages).toEqual([{
      type: 'focus-new-task-summary',
      schemaVersion: 2,
    }]);
  });

  it('announces meaningful web content only to the current companion bridge', () => {
    const messages: unknown[] = [];

    expect(publishTaskNativeContentReady({} as Window)).toBe(false);
    expect(publishTaskNativeContentReady(bridgeWindow(messages, 1))).toBe(false);
    expect(publishTaskNativeContentReady(bridgeWindow(messages))).toBe(true);
    expect(messages).toEqual([{
      type: 'content-ready',
      schemaVersion: 2,
    }]);
  });

  it('announces a mounted quick-entry editor only to the current companion bridge', () => {
    const messages: unknown[] = [];

    expect(publishTaskNativeQuickEntryReady({} as Window)).toBe(false);
    expect(publishTaskNativeQuickEntryReady(bridgeWindow(messages, 1))).toBe(false);
    expect(publishTaskNativeQuickEntryReady(bridgeWindow(messages))).toBe(true);
    expect(messages).toEqual([{
      type: 'quick-entry-ready',
      schemaVersion: 2,
    }]);
  });

  it('requests immediate quick-entry dismissal only through the current companion bridge', () => {
    const messages: unknown[] = [];

    expect(requestTaskNativeQuickEntryDismissal({} as Window)).toBe(false);
    expect(requestTaskNativeQuickEntryDismissal(bridgeWindow(messages, 1))).toBe(false);
    expect(requestTaskNativeQuickEntryDismissal(bridgeWindow(messages))).toBe(true);
    expect(messages).toEqual([{
      type: 'quick-entry-dismiss-requested',
      schemaVersion: 2,
    }]);
  });

  it('configures, clears, and finishes Mac quick entry only through the current bridge', () => {
    const messages: unknown[] = [];
    const shortcut = {
      code: 'Space',
      command: false,
      control: true,
      option: true,
      shift: false,
    };

    expect(configureTaskNativeQuickEntryShortcut(shortcut, {} as Window)).toBe(false);
    expect(configureTaskNativeQuickEntryShortcut(
      shortcut,
      bridgeWindow(messages, 1),
    )).toBe(false);
    expect(configureTaskNativeQuickEntryShortcut(
      shortcut,
      bridgeWindow(messages),
    )).toBe(true);
    expect(clearTaskNativeQuickEntryShortcut({} as Window)).toBe(false);
    expect(clearTaskNativeQuickEntryShortcut(bridgeWindow(messages, 1))).toBe(false);
    expect(clearTaskNativeQuickEntryShortcut(bridgeWindow(messages))).toBe(true);
    expect(finishTaskNativeQuickEntry(true, bridgeWindow(messages))).toBe(true);
    expect(finishTaskNativeQuickEntry(false, bridgeWindow(messages))).toBe(true);
    expect(messages).toEqual([
      {
        type: 'configure-quick-entry-shortcut',
        schemaVersion: 2,
        shortcut,
      },
      {
        type: 'clear-quick-entry-shortcut',
        schemaVersion: 2,
      },
      {
        type: 'quick-entry-finished',
        schemaVersion: 2,
        committed: true,
      },
      {
        type: 'quick-entry-finished',
        schemaVersion: 2,
        committed: false,
      },
    ]);
  });

  it('accepts only UUID native-task links and removes just that parameter', () => {
    expect(getNativeTaskDeepLinkId(`?native_task=${taskA}`)).toBe(taskA);
    expect(getNativeTaskDeepLinkId('?native_task=not-a-task')).toBeNull();
    expect(removeNativeTaskDeepLink(`?native_task=${taskA}&reminder_delivery=delivery-a`))
      .toBe('?reminder_delivery=delivery-a');
  });

  it('accepts one exact native-new-task signal and removes only that parameter', () => {
    expect(hasNativeNewTaskSignal('?native_new_task=1')).toBe(true);
    expect(hasNativeNewTaskSignal('?native_new_task=list')).toBe(true);
    expect(getNativeNewTaskSignal('?native_new_task=1')).toBe('today-inbox');
    expect(getNativeNewTaskSignal('?native_new_task=list')).toBe('current-list');
    expect(hasNativeNewTaskSignal('?native_new_task=0')).toBe(false);
    expect(hasNativeNewTaskSignal('?native_new_task=1&native_new_task=1')).toBe(false);
    expect(hasNativeNewTaskSignal('?native_new_task=today')).toBe(false);
    expect(getNativeNewTaskSignal('?native_new_task=today')).toBeNull();
    expect(removeNativeNewTaskSignal(
      '?native_new_task=1&reminder_delivery=delivery-a',
    )).toBe('?reminder_delivery=delivery-a');
  });

  it('recognizes only the active Mac quick-entry route signal', () => {
    expect(isTaskNativeQuickEntry('?native_quick_entry=1')).toBe(true);
    expect(isTaskNativeQuickEntry('?native_quick_entry=0')).toBe(false);
    expect(isTaskNativeQuickEntry('?native_new_task=1')).toBe(false);
  });
});
