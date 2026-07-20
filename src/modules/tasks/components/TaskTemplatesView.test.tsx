import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskTemplatesView } from './TaskTemplatesView';

const capture = vi.fn().mockResolvedValue({});
const archive = vi.fn().mockResolvedValue({});
const instantiate = vi.fn().mockResolvedValue({
  result: { project_id: null, root_id: 'created-task' },
});
const mockUseTaskTemplates = vi.fn();
const mockUseTaskRecurrences = vi.fn();
const recurrenceSave = vi.fn().mockResolvedValue({});

vi.mock('@/modules/tasks/hooks/useTaskTemplates', () => ({
  useTaskTemplates: (...args: unknown[]) => mockUseTaskTemplates(...args),
}));
vi.mock('@/modules/tasks/hooks/useTaskRecurrences', () => ({
  useTaskRecurrences: (...args: unknown[]) => mockUseTaskRecurrences(...args),
}));

vi.mock('@/platform/hooks/useHostModule', () => ({
  useModuleBasePath: () => '/tasks',
}));

const source = {
  id: 'source-task',
  title: 'Weekly Review',
};
const template = {
  id: 'template-a',
  owner_id: 'owner-a',
  kind: 'todo',
  name: 'Weekly Review',
  current_revision: 1,
  record_revision: 1,
  archived_at: null,
  last_mutation_channel: 'web',
  last_actor_type: 'user',
  client_mutation_id: 'mutation-a',
  created_at: '2026-07-20T00:00:00Z',
  updated_at: '2026-07-20T00:00:00Z',
};
const revision = {
  id: 'revision-a',
  owner_id: 'owner-a',
  template_id: template.id,
  revision: 1,
  name: template.name,
  source_type: 'todo',
  source_id: source.id,
  source_revision: 1,
  anchor_date: '2026-07-20',
  snapshot: {
    version: 1,
    kind: 'todo',
    root: {
      node_id: 'root',
      title: template.name,
      notes: '',
      actionability: 'actionable',
      destination: 'anytime',
      today_section: 'daytime',
      order_key: 'a0',
      start_offset_days: null,
      deadline_offset_days: null,
      checklist: [],
    },
  },
  client_mutation_id: 'mutation-a',
  created_at: '2026-07-20T00:00:00Z',
};

function model(mode: 'local' | 'connected') {
  return {
    templates: [template],
    revisions: new Map([[template.id, revision]]),
    todos: [source],
    projects: [],
    mode,
    planningDate: '2026-07-20',
    loading: false,
    error: null,
    capture,
    archive,
    instantiate,
  };
}

const hierarchy = {
  areas: [],
  projects: [],
  headings: [],
  loading: false,
  error: null,
};

function renderView() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <MemoryRouter initialEntries={['/tasks/templates']}>
      <TaskTemplatesView ownerId="owner-a" hierarchy={hierarchy as never} />
    </MemoryRouter>,
  ));
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('TaskTemplatesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTaskRecurrences.mockReturnValue({
      definitions: [],
      revisions: new Map(),
      occurrences: [],
      planningDate: '2026-07-20',
      mode: 'connected',
      loading: false,
      error: null,
      save: recurrenceSave,
      setStatus: vi.fn(),
      evaluate: vi.fn(),
    });
  });

  it('keeps synchronized templates visible but disables mutation in local mode', () => {
    mockUseTaskTemplates.mockReturnValue(model('local'));
    mockUseTaskRecurrences.mockReturnValue({
      ...mockUseTaskRecurrences(),
      mode: 'local',
    });
    const { container, root } = renderView();
    try {
      expect(container.textContent).toContain('Weekly Review');
      expect(container.textContent).toContain('Connect Task Storage to Save or Create Templates');
      expect(Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Create')?.disabled).toBe(true);
    } finally {
      cleanup(root, container);
    }
  });

  it('captures current work and instantiates the immutable current revision', async () => {
    mockUseTaskTemplates.mockReturnValue(model('connected'));
    const { container, root } = renderView();
    try {
      const name = container.querySelector<HTMLInputElement>('[data-template-name]')!;
      await act(async () => setInput(name, 'Monday Review'));
      await act(async () => {
        name.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      expect(capture).toHaveBeenCalledWith({
        templateId: null,
        sourceType: 'todo',
        sourceId: source.id,
        name: 'Monday Review',
        anchorDate: '2026-07-20',
      });

      const create = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Create')!;
      await act(async () => create.click());
      expect(instantiate).toHaveBeenCalledWith({
        templateId: template.id,
        templateRevision: 1,
        anchorDate: '2026-07-20',
        targetAreaId: null,
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('saves an explicit recurrence rule from the current template revision', async () => {
    mockUseTaskTemplates.mockReturnValue(model('connected'));
    const { container, root } = renderView();
    try {
      const repeatName = container.querySelector<HTMLInputElement>('[data-recurrence-name]')!;
      await act(async () => setInput(repeatName, 'Weekly Review Repeat'));
      await act(async () => {
        repeatName.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      expect(recurrenceSave).toHaveBeenCalledWith({
        recurrenceId: undefined,
        expectedRecordRevision: undefined,
        name: 'Weekly Review Repeat',
        templateId: template.id,
        templateRevision: 1,
        ruleMode: 'calendar',
        frequency: 'weekly',
        intervalCount: 1,
        startDate: '2026-07-20',
        missedPolicy: 'latest',
        catchUpLimit: 50,
        targetAreaId: null,
      });
    } finally {
      cleanup(root, container);
    }
  });
});
