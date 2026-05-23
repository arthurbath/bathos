import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { CorpusDocumentsView } from '@/modules/corpus/components/CorpusDocumentsView';
import type { CorpusDocument, CorpusDocumentInput, CorpusDocumentUpdate, CorpusTag } from '@/modules/corpus/types/corpus';

function mount(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function makeTag(id: string, name: string): CorpusTag {
  return {
    id,
    user_id: 'user-1',
    name,
    description: null,
    created_at: '2026-05-23T10:00:00.000Z',
    updated_at: '2026-05-23T10:00:00.000Z',
  };
}

function makeDocument({
  id,
  title,
  updatedAt,
  tags = [],
}: {
  id: string;
  title: string;
  updatedAt: string;
  tags?: CorpusTag[];
}): CorpusDocument {
  return {
    id,
    user_id: 'user-1',
    title,
    content: `${title} content`,
    content_type: 'markdown',
    source_filename: null,
    created_at: '2026-05-23T10:00:00.000Z',
    updated_at: updatedAt,
    tags,
  };
}

function getVisibleDocumentTitles(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLInputElement>('tbody input[data-col="0"]'))
    .map((input) => input.value);
}

function renderDocumentsView({
  documents,
  tags = [],
}: {
  documents: CorpusDocument[];
  tags?: CorpusTag[];
}) {
  return mount(
    <CorpusDocumentsView
      userId=""
      documents={documents}
      tags={tags}
      loading={false}
      onAddDocument={async (input: CorpusDocumentInput) => makeDocument({
        id: 'new-document',
        title: input.title,
        updatedAt: '2026-05-23T12:00:00.000Z',
      })}
      onUpdateDocument={async (id: string, updates: CorpusDocumentUpdate) => ({
        ...documents.find((document) => document.id === id)!,
        ...updates,
      })}
      onSetDocumentTags={async () => {}}
      onDeleteDocument={async () => {}}
    />,
  );
}

describe('CorpusDocumentsView persisted controls', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores sorting from localStorage', () => {
    localStorage.setItem('corpus_documents_sorting', JSON.stringify([{ id: 'title', desc: true }]));
    const documents = [
      makeDocument({ id: 'doc-a', title: 'Alpha', updatedAt: '2026-05-23T12:00:00.000Z' }),
      makeDocument({ id: 'doc-b', title: 'Bravo', updatedAt: '2026-05-23T11:00:00.000Z' }),
    ];

    const { container, root } = renderDocumentsView({ documents });

    try {
      expect(getVisibleDocumentTitles(container)).toEqual(['Bravo', 'Alpha']);
    } finally {
      unmount(root, container);
    }
  });

  it('restores document name and tag filters from localStorage', () => {
    const styleTag = makeTag('tag-style', 'Style Conventions');
    localStorage.setItem('corpus_documents_filterName', 'grammar');
    localStorage.setItem('corpus_documents_tagFilters', JSON.stringify([styleTag.id]));
    const documents = [
      makeDocument({
        id: 'doc-a',
        title: 'Grammar Style Guide',
        updatedAt: '2026-05-23T12:00:00.000Z',
        tags: [styleTag],
      }),
      makeDocument({
        id: 'doc-b',
        title: 'Grammar Notes Without Tag',
        updatedAt: '2026-05-23T11:00:00.000Z',
      }),
      makeDocument({
        id: 'doc-c',
        title: 'Tone Example',
        updatedAt: '2026-05-23T10:00:00.000Z',
        tags: [styleTag],
      }),
    ];

    const { container, root } = renderDocumentsView({ documents, tags: [styleTag] });

    try {
      expect(getVisibleDocumentTitles(container)).toEqual(['Grammar Style Guide']);
    } finally {
      unmount(root, container);
    }
  });

  it('persists changed sorting to localStorage', () => {
    const documents = [
      makeDocument({ id: 'doc-a', title: 'Alpha', updatedAt: '2026-05-23T12:00:00.000Z' }),
      makeDocument({ id: 'doc-b', title: 'Bravo', updatedAt: '2026-05-23T11:00:00.000Z' }),
    ];
    const { container, root } = renderDocumentsView({ documents });

    try {
      const titleHeader = Array.from(container.querySelectorAll('th'))
        .find((header) => header.textContent?.includes('Title'));
      expect(titleHeader).toBeDefined();

      act(() => {
        titleHeader!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(localStorage.getItem('corpus_documents_sorting')).toContain('"id":"title"');
    } finally {
      unmount(root, container);
    }
  });
});
