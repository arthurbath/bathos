import { taskAreaFixture, taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';

import {
  buildTaskNativeWidgetSnapshot,
  clearTaskNativeWidgetCache,
  getNativeTaskDeepLinkId,
  publishTaskNativeWidgetSnapshot,
  removeNativeTaskDeepLink,
  resetTaskNativeWidgetPublisherForTests,
} from './taskNativeWidgetBridge';

const ownerId = '00000000-0000-4000-8000-000000000001';
const taskA = '10000000-0000-4000-8000-000000000001';
const taskB = '10000000-0000-4000-8000-000000000002';
const taskC = '10000000-0000-4000-8000-000000000003';

function bridgeWindow(messages: unknown[]): Window {
  return {
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
      expect.objectContaining({ id: taskA, summary: 'Today Task' }),
    ]);
    expect(snapshot.lists.find(({ id }) => id === 'upcoming')?.tasks).toEqual([
      expect.objectContaining({ id: taskB }),
    ]);
    expect(snapshot.lists.find(({ id }) => id === 'someday')?.tasks).toEqual([
      expect.objectContaining({ id: taskC }),
    ]);
    expect(JSON.stringify(snapshot)).not.toContain('Private Notes');
    expect(JSON.stringify(snapshot)).not.toContain('private.example');
    expect(JSON.stringify(snapshot)).not.toContain('Other Owner');
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

  it('accepts only UUID native-task links and removes just that parameter', () => {
    expect(getNativeTaskDeepLinkId(`?native_task=${taskA}`)).toBe(taskA);
    expect(getNativeTaskDeepLinkId('?native_task=not-a-task')).toBeNull();
    expect(removeNativeTaskDeepLink(`?native_task=${taskA}&reminder_delivery=delivery-a`))
      .toBe('?reminder_delivery=delivery-a');
  });
});
