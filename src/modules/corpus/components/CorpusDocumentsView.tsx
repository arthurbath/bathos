import { useEffect, useMemo, useRef, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { Download, FileText, FileUp, Filter, FilterX, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataGrid, GridEditableCell, gridMenuTriggerProps, gridSelectTriggerProps, useDataGrid } from '@/components/ui/data-grid';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LabelWithAside } from '@/components/ui/label-with-aside';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { CORPUS_DOCUMENTS_GRID_DEFAULT_WIDTHS, GRID_FIXED_COLUMNS } from '@/lib/gridColumnWidths';
import { MarkdownSyntaxTextarea } from '@/modules/corpus/components/MarkdownSyntaxTextarea';
import type { CorpusDocument, CorpusDocumentInput, CorpusDocumentUpdate, CorpusTag } from '@/modules/corpus/types/corpus';

interface CorpusDocumentsViewProps {
  userId: string;
  documents: CorpusDocument[];
  tags: CorpusTag[];
  loading: boolean;
  onAddDocument: (input: CorpusDocumentInput, id?: string) => Promise<CorpusDocument>;
  onUpdateDocument: (id: string, updates: CorpusDocumentUpdate) => Promise<CorpusDocument>;
  onSetDocumentTags: (documentId: string, tagIds: string[], optimisticTags?: CorpusTag[]) => Promise<void>;
  onDeleteDocument: (id: string) => Promise<void>;
}

const columnHelper = createColumnHelper<CorpusDocument>();
const HISTORY_KEY = 'corpus_documents';
const CREATE_NEW_DOCUMENT_VALUE = '_create_new';
const OPEN_DOCUMENT_NAV_COL = 0.5;
const SORTING_STORAGE_KEY = 'corpus_documents_sorting';
const QUERY_STORAGE_KEY = 'corpus_documents_filterName';
const TAG_FILTERS_STORAGE_KEY = 'corpus_documents_tagFilters';
const SORTABLE_COLUMN_IDS = new Set(['title', 'characters', 'updated_at']);

function getDefaultSorting(): SortingState {
  return [{ id: 'updated_at', desc: true }];
}

function readStoredSorting(): SortingState {
  try {
    const raw = localStorage.getItem(SORTING_STORAGE_KEY);
    if (!raw) return getDefaultSorting();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDefaultSorting();
    const validSorting = parsed.filter((entry): entry is { id: string; desc: boolean } => {
      if (typeof entry !== 'object' || entry === null) return false;
      const candidate = entry as { id?: unknown; desc?: unknown };
      return typeof candidate.id === 'string'
        && SORTABLE_COLUMN_IDS.has(candidate.id)
        && typeof candidate.desc === 'boolean';
    });
    return validSorting.length > 0 ? validSorting : getDefaultSorting();
  } catch {
    return getDefaultSorting();
  }
}

function readStoredText(key: string) {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function readStoredStringArray(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function retainKnownValues(values: string[], knownValues: Set<string>) {
  return values.filter((value) => knownValues.has(value));
}

function stringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function titleFromFilename(fileName: string) {
  return fileName.replace(/\.(md|markdown|txt)$/i, '').trim() || fileName;
}

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function filenameFromTitle(title: string) {
  const sanitized = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim();
  return `${sanitized || 'corpus-document'}.md`;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function fileFailureMessage(fileName: string, error: unknown) {
  return `${fileName}: ${messageFromError(error)}`;
}

function TagCell({
  tags,
  options,
  onChange,
  navCol,
}: {
  tags: CorpusTag[];
  options: CorpusTag[];
  onChange: (tagIds: string[]) => void | Promise<void>;
  navCol: number;
}) {
  const ctx = useDataGrid();
  const selectedIds = tags.map((tag) => tag.id);
  return (
    <MultiSelectFilter
      label="Tags"
      options={options.map((tag) => ({ value: tag.id, label: tag.name }))}
      selectedValues={selectedIds}
      onSelectedValuesChange={onChange}
      allLabel={selectedIds.length === options.length ? 'All Tags' : undefined}
      noneLabel="No Tags"
      triggerClassName="h-7 w-full justify-between border-transparent bg-transparent px-1 text-xs hover:border-[hsl(var(--grid-sticky-line))]"
      showBulkActions={false}
      deferSelectionUntilClose
      triggerProps={gridSelectTriggerProps(ctx, navCol)}
      onRestoreTriggerFocus={ctx ? () => ctx.restoreCellFocus(navCol) : undefined}
    />
  );
}

function ActionsCell({
  document,
  onEdit,
  onOverwrite,
  onDownload,
  onDelete,
  navCol,
}: {
  document: CorpusDocument;
  onEdit: (document: CorpusDocument) => void;
  onOverwrite: (document: CorpusDocument) => void;
  onDownload: (document: CorpusDocument) => void;
  onDelete: (document: CorpusDocument) => void;
  navCol: number;
}) {
  const ctx = useDataGrid();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          type="button"
          className="float-right mr-[5px] h-7 w-7"
          aria-label={`Actions for ${document.title}`}
          {...gridMenuTriggerProps(ctx, navCol)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuItem onClick={() => onEdit(document)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit Content
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOverwrite(document)}>
          <FileUp className="mr-2 h-4 w-4" />
          Overwrite
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDownload(document)}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(document)} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TitleCell({
  document,
  onTitleChange,
  onOpenDocument,
}: {
  document: CorpusDocument;
  onTitleChange: (value: string) => void;
  onOpenDocument: (document: CorpusDocument) => void;
}) {
  const ctx = useDataGrid();
  return (
    <div className="flex min-w-0 items-center gap-1">
      <GridEditableCell
        value={document.title}
        navCol={0}
        onChange={onTitleChange}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground/80 hover:text-foreground"
        aria-label={`Open document for ${document.title}`}
        title="Open Document"
        onClick={() => onOpenDocument(document)}
        {...gridMenuTriggerProps(ctx, OPEN_DOCUMENT_NAV_COL)}
      >
        <FileText className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function CorpusDocumentsView({
  userId,
  documents,
  tags,
  loading,
  onAddDocument,
  onUpdateDocument,
  onSetDocumentTags,
  onDeleteDocument,
}: CorpusDocumentsViewProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const overwriteInputRef = useRef<HTMLInputElement | null>(null);
  const bulkOverwriteInputRef = useRef<HTMLInputElement | null>(null);
  const overwriteTargetRef = useRef<CorpusDocument | null>(null);
  const isMobile = useIsMobile();
  const [sorting, setSorting] = useState<SortingState>(() => readStoredSorting());
  const [query, setQuery] = useState(() => readStoredText(QUERY_STORAGE_KEY));
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>(() => readStoredStringArray(TAG_FILTERS_STORAGE_KEY));
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState('');
  const [draftSelectedTagFilters, setDraftSelectedTagFilters] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<CorpusDocument | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [overwriting, setOverwriting] = useState(false);
  const [bulkOverwriteOpen, setBulkOverwriteOpen] = useState(false);
  const [bulkOverwriteFiles, setBulkOverwriteFiles] = useState<File[]>([]);
  const [bulkOverwriteMappings, setBulkOverwriteMappings] = useState<Record<number, string>>({});
  const [bulkOverwriting, setBulkOverwriting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CorpusDocument | null>(null);
  const hasTags = tags.length > 0;
  const tagIdSignature = useMemo(() => tags.map((tag) => tag.id).join('\u0000'), [tags]);

  useEffect(() => {
    localStorage.setItem(SORTING_STORAGE_KEY, JSON.stringify(sorting));
  }, [sorting]);

  useEffect(() => {
    localStorage.setItem(QUERY_STORAGE_KEY, query);
  }, [query]);

  useEffect(() => {
    localStorage.setItem(TAG_FILTERS_STORAGE_KEY, JSON.stringify(selectedTagFilters));
  }, [selectedTagFilters]);

  useEffect(() => {
    if (!hasTags) {
      setSelectedTagFilters((current) => (current.length === 0 ? current : []));
      setDraftTagIds((current) => (current.length === 0 ? current : []));
      setDraftSelectedTagFilters((current) => (current.length === 0 ? current : []));
      return;
    }

    const knownTagIds = new Set(tagIdSignature.split('\u0000').filter(Boolean));
    setSelectedTagFilters((current) => {
      const next = retainKnownValues(current, knownTagIds);
      return stringArraysEqual(current, next) ? current : next;
    });
    setDraftTagIds((current) => {
      const next = retainKnownValues(current, knownTagIds);
      return stringArraysEqual(current, next) ? current : next;
    });
    setDraftSelectedTagFilters((current) => {
      const next = retainKnownValues(current, knownTagIds);
      return stringArraysEqual(current, next) ? current : next;
    });
  }, [hasTags, tagIdSignature]);

  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'corpus_documents',
    defaults: CORPUS_DOCUMENTS_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.corpus_documents,
  });

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return documents.filter((document) => {
      if (hasTags && selectedTagFilters.length > 0) {
        const documentTagIds = new Set(document.tags.map((tag) => tag.id));
        if (!selectedTagFilters.every((tagId) => documentTagIds.has(tagId))) return false;
      }
      if (!normalizedQuery) return true;
      return document.title.toLocaleLowerCase().includes(normalizedQuery);
    });
  }, [documents, hasTags, query, selectedTagFilters]);

  const openNewEditor = () => {
    setEditingDocument(null);
    setDraftTitle('');
    setDraftContent('');
    setDraftTagIds([]);
    setEditorOpen(true);
  };

  const openViewControlsModal = () => {
    setDraftQuery(query);
    setDraftSelectedTagFilters(selectedTagFilters);
    setViewControlsOpen(true);
  };

  const applyViewControls = () => {
    setQuery(draftQuery);
    setSelectedTagFilters(draftSelectedTagFilters);
    setViewControlsOpen(false);
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedTagFilters([]);
    setDraftQuery('');
    setDraftSelectedTagFilters([]);
  };

  const openExistingEditor = (document: CorpusDocument) => {
    setEditingDocument(document);
    setDraftTitle(document.title);
    setDraftContent(document.content);
    setDraftTagIds(document.tags.map((tag) => tag.id));
    setEditorOpen(true);
  };

  const saveEditor = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (editingDocument) {
        await onUpdateDocument(editingDocument.id, {
          title: draftTitle,
          content: draftContent,
          content_type: 'markdown',
        });
        if (hasTags) {
          await onSetDocumentTags(
            editingDocument.id,
            draftTagIds,
            tags.filter((tag) => draftTagIds.includes(tag.id)),
          );
        }
      } else {
        await onAddDocument({
          title: draftTitle,
          content: draftContent,
          content_type: 'markdown',
          tagIds: hasTags ? draftTagIds : [],
        });
      }
      setEditorOpen(false);
    } catch (error) {
      toast({ title: 'Failed to Save Document', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const supportedFiles = Array.from(files).filter((file) => /\.(md|markdown|txt)$/i.test(file.name));
    if (supportedFiles.length !== files.length) {
      toast({ title: 'Some Files Were Skipped', description: 'Corpus accepts MD and TXT files only.', variant: 'destructive' });
    }
    const failedFiles: string[] = [];
    for (const file of supportedFiles) {
      try {
        const content = await file.text();
        await onAddDocument({
          title: titleFromFilename(file.name),
          content,
          content_type: 'markdown',
          source_filename: file.name,
          tagIds: [],
        });
      } catch (error) {
        failedFiles.push(fileFailureMessage(file.name, error));
      }
    }
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    if (failedFiles.length > 0) {
      toast({
        title: failedFiles.length === 1 ? 'Failed to Upload File' : 'Some Files Failed to Upload',
        description: failedFiles.slice(0, 3).join('\n'),
        variant: 'destructive',
      });
    }
  };

  const autoMapBulkOverwriteFiles = (files: File[]) => {
    const claimedDocumentIds = new Set<string>();
    const nextMappings: Record<number, string> = {};

    files.forEach((file, index) => {
      const title = titleFromFilename(file.name);
      const match = documents.find((document) => document.title === title && !claimedDocumentIds.has(document.id));
      if (match) {
        claimedDocumentIds.add(match.id);
        nextMappings[index] = match.id;
      } else {
        nextMappings[index] = CREATE_NEW_DOCUMENT_VALUE;
      }
    });

    return nextMappings;
  };

  const openBulkOverwritePicker = () => {
    if (bulkOverwriteInputRef.current) bulkOverwriteInputRef.current.value = '';
    bulkOverwriteInputRef.current?.click();
  };

  const prepareBulkOverwrite = (files: FileList | null) => {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    const supportedFiles = selectedFiles.filter((file) => /\.(md|markdown|txt)$/i.test(file.name));
    if (supportedFiles.length !== selectedFiles.length) {
      toast({ title: 'Some Files Were Skipped', description: 'Corpus accepts MD and TXT files only.', variant: 'destructive' });
    }
    if (supportedFiles.length === 0) {
      if (bulkOverwriteInputRef.current) bulkOverwriteInputRef.current.value = '';
      return;
    }

    setBulkOverwriteFiles(supportedFiles);
    setBulkOverwriteMappings(autoMapBulkOverwriteFiles(supportedFiles));
    setBulkOverwriteOpen(true);
  };

  const closeBulkOverwriteDialog = () => {
    if (bulkOverwriting) return;
    setBulkOverwriteOpen(false);
    setBulkOverwriteFiles([]);
    setBulkOverwriteMappings({});
    if (bulkOverwriteInputRef.current) bulkOverwriteInputRef.current.value = '';
  };

  const setBulkOverwriteMapping = (index: number, value: string) => {
    setBulkOverwriteMappings((current) => ({ ...current, [index]: value }));
  };

  const applyBulkOverwrite = async () => {
    if (bulkOverwriting || bulkOverwriteFiles.length === 0) return;

    setBulkOverwriting(true);
    let overwrittenCount = 0;
    let createdCount = 0;
    let activeFileName = '';
    try {
      for (let index = 0; index < bulkOverwriteFiles.length; index += 1) {
        const file = bulkOverwriteFiles[index];
        activeFileName = file.name;
        const content = await file.text();
        const title = titleFromFilename(file.name);
        const mapping = bulkOverwriteMappings[index] ?? CREATE_NEW_DOCUMENT_VALUE;

        if (mapping === CREATE_NEW_DOCUMENT_VALUE) {
          await onAddDocument({
            title,
            content,
            content_type: 'markdown',
            source_filename: file.name,
            tagIds: [],
          });
          createdCount += 1;
        } else {
          await onUpdateDocument(mapping, {
            title,
            content,
            content_type: 'markdown',
          });
          overwrittenCount += 1;
        }
      }

      setBulkOverwriteOpen(false);
      setBulkOverwriteFiles([]);
      setBulkOverwriteMappings({});
      if (bulkOverwriteInputRef.current) bulkOverwriteInputRef.current.value = '';
      toast({
        title: 'Bulk Overwrite Complete',
        description: `${overwrittenCount} overwritten · ${createdCount} created`,
      });
    } catch (error) {
      toast({ title: 'Bulk Overwrite Failed', description: activeFileName ? fileFailureMessage(activeFileName, error) : messageFromError(error), variant: 'destructive' });
    } finally {
      setBulkOverwriting(false);
    }
  };

  const openOverwritePicker = (document: CorpusDocument) => {
    overwriteTargetRef.current = document;
    if (overwriteInputRef.current) overwriteInputRef.current.value = '';
    overwriteInputRef.current?.click();
  };

  const overwriteDocumentFromFile = async (files: FileList | null) => {
    const target = overwriteTargetRef.current;
    const file = files?.[0] ?? null;
    if (!target || !file) {
      overwriteTargetRef.current = null;
      return;
    }
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      toast({ title: 'File Was Skipped', description: 'Corpus accepts MD and TXT files only.', variant: 'destructive' });
      overwriteTargetRef.current = null;
      if (overwriteInputRef.current) overwriteInputRef.current.value = '';
      return;
    }

    setOverwriting(true);
    try {
      const content = await file.text();
      await onUpdateDocument(target.id, {
        content,
        content_type: 'markdown',
      });
      toast({ title: 'Document Overwritten' });
    } catch (error) {
      toast({ title: 'Failed to Overwrite Document', description: fileFailureMessage(file.name, error), variant: 'destructive' });
    } finally {
      setOverwriting(false);
      overwriteTargetRef.current = null;
      if (overwriteInputRef.current) overwriteInputRef.current.value = '';
    }
  };

  const downloadDocument = (corpusDocument: CorpusDocument) => {
    try {
      const blob = new Blob([corpusDocument.content], { type: 'text/markdown;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = filenameFromTitle(corpusDocument.title);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast({ title: 'Download Started' });
    } catch (error) {
      toast({ title: 'Download Failed', description: error instanceof Error ? error.message : 'Unable to prepare the download.', variant: 'destructive' });
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: 'Title',
        size: CORPUS_DOCUMENTS_GRID_DEFAULT_WIDTHS.title,
        minSize: 160,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <TitleCell
            document={row.original}
            onTitleChange={(value) => onUpdateDocument(row.original.id, { title: value })}
            onOpenDocument={openExistingEditor}
          />
        ),
      }),
      ...(hasTags
        ? [
            columnHelper.display({
              id: 'tags',
              header: 'Tags',
              size: CORPUS_DOCUMENTS_GRID_DEFAULT_WIDTHS.tags,
              minSize: 180,
              meta: { containsButton: true },
              cell: ({ row }) => (
                <TagCell
                  tags={row.original.tags}
                  options={tags}
                  onChange={(tagIds) => onSetDocumentTags(
                    row.original.id,
                    tagIds,
                    tags.filter((tag) => tagIds.includes(tag.id)),
                  )}
                  navCol={1}
                />
              ),
            }),
          ]
        : []),
      columnHelper.accessor((row) => row.content.length, {
        id: 'characters',
        header: 'Characters',
        size: CORPUS_DOCUMENTS_GRID_DEFAULT_WIDTHS.characters,
        minSize: 100,
        meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums text-xs' },
        cell: ({ getValue }) => getValue().toLocaleString(),
      }),
      columnHelper.accessor('updated_at', {
        header: 'Updated',
        size: CORPUS_DOCUMENTS_GRID_DEFAULT_WIDTHS.updated_at,
        minSize: 180,
        cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{formatDate(getValue())}</span>,
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        enableResizing: false,
        size: CORPUS_DOCUMENTS_GRID_DEFAULT_WIDTHS.actions,
        minSize: CORPUS_DOCUMENTS_GRID_DEFAULT_WIDTHS.actions,
        maxSize: CORPUS_DOCUMENTS_GRID_DEFAULT_WIDTHS.actions,
        meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
        cell: ({ row }) => (
          <ActionsCell
            document={row.original}
            onEdit={openExistingEditor}
            onOverwrite={openOverwritePicker}
            onDownload={downloadDocument}
            onDelete={setDeleteTarget}
            navCol={hasTags ? 4 : 3}
          />
        ),
      }),
    ],
    [hasTags, onSetDocumentTags, onUpdateDocument, tags],
  );

  const table = useReactTable({
    data: filteredDocuments,
    columns,
    defaultColumn: { minSize: 80 },
    state: { sorting, columnSizing, columnSizingInfo },
    enableColumnResizing: columnResizingEnabled,
    onSortingChange: setSorting,
    onColumnSizingChange,
    onColumnSizingInfoChange,
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hasFilters = query.trim().length > 0 || (hasTags && selectedTagFilters.length > 0);

  return (
    <>
      <Card className="max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0 h-full min-h-0 flex flex-col border-t-0 border-b-0 md:border-t">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Documents</CardTitle>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {isMobile ? (
              <>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={openViewControlsModal}>
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
                <Button
                  type="button"
                  variant="outline-warning"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={clearFilters}
                  disabled={!hasFilters}
                  aria-label="Clear filters"
                >
                  <FilterX className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Document Name"
                  className="h-8 w-40 text-sm"
                  aria-label="Document Name"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {hasTags && (
                  <MultiSelectFilter
                    label="Tags"
                    options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
                    selectedValues={selectedTagFilters}
                    onSelectedValuesChange={setSelectedTagFilters}
                    allLabel="All Tags"
                    noneLabel="No Tags"
                    triggerClassName="w-44"
                  />
                )}
                <Button
                  type="button"
                  variant="outline-warning"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={clearFilters}
                  disabled={!hasFilters}
                  aria-label="Clear filters"
                >
                  <FilterX className="h-4 w-4" />
                </Button>
              </>
            )}
            <input
              ref={uploadInputRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              multiple
              className="hidden"
              onChange={(event) => void uploadFiles(event.target.files)}
            />
            <input
              ref={overwriteInputRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="hidden"
              disabled={overwriting}
              onChange={(event) => void overwriteDocumentFromFile(event.target.files)}
            />
            <input
              ref={bulkOverwriteInputRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              multiple
              className="hidden"
              disabled={bulkOverwriting}
              onChange={(event) => prepareBulkOverwrite(event.target.files)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline-success" size="sm" className="h-8 w-8 p-0" aria-label="Add document">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={openNewEditor}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => uploadInputRef.current?.click()}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Upload
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openBulkOverwritePicker}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Bulk Overwrite
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0 flex-1 min-h-0">
          <DataGrid
            table={table}
            historyKey={HISTORY_KEY}
            fullView
            maxHeight="none"
            className="h-full min-h-0"
            emptyMessage={loading ? 'Loading documents…' : hasFilters ? 'No documents match the filter' : 'No documents yet.'}
          />
        </CardContent>
      </Card>

      <Dialog open={viewControlsOpen} onOpenChange={setViewControlsOpen}>
        <DialogContent aria-describedby={undefined} className="w-screen max-w-none rounded-none sm:w-full sm:max-w-sm sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="corpus-documents-filter-query">Name</Label>
              <Input
                id="corpus-documents-filter-query"
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="Document Name"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="text-sm"
              />
            </div>
            {hasTags && (
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <MultiSelectFilter
                  label="Tags"
                  options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
                  selectedValues={draftSelectedTagFilters}
                  onSelectedValuesChange={setDraftSelectedTagFilters}
                  allLabel="All Tags"
                  noneLabel="No Tags"
                  triggerClassName="h-9 w-full"
                />
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewControlsOpen(false)}>
              Cancel
            </Button>
            <Button data-dialog-confirm="true" type="button" onClick={applyViewControls}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOverwriteOpen} onOpenChange={(open) => (open ? setBulkOverwriteOpen(true) : closeBulkOverwriteDialog())}>
        <DialogContent aria-describedby={undefined} className="w-screen max-w-none rounded-none sm:w-full sm:max-w-2xl sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Bulk Overwrite</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="overflow-hidden rounded-md border border-[hsl(var(--grid-sticky-line))]">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-b border-[hsl(var(--grid-sticky-line))] bg-muted/30 text-xs font-medium text-muted-foreground">
                <div className="px-3 py-2">Uploaded File</div>
                <div className="px-3 py-2">Overwrite Target</div>
              </div>
              <div className="max-h-[50vh] overflow-y-auto">
                {bulkOverwriteFiles.map((file, index) => {
                  const selectedDocumentIds = new Set(
                    Object.entries(bulkOverwriteMappings)
                      .filter(([entryIndex, value]) => Number(entryIndex) !== index && value !== CREATE_NEW_DOCUMENT_VALUE)
                      .map(([, value]) => value),
                  );
                  const currentValue = bulkOverwriteMappings[index] ?? CREATE_NEW_DOCUMENT_VALUE;

                  return (
                    <div key={`${file.name}-${file.lastModified}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center border-b border-[hsl(var(--grid-sticky-line))] last:border-b-0">
                      <div className="min-w-0 truncate px-3 py-2 text-sm">{file.name}</div>
                      <div className="px-3 py-2">
                        <Select value={currentValue} onValueChange={(value) => setBulkOverwriteMapping(index, value)}>
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={CREATE_NEW_DOCUMENT_VALUE}>Create New Document</SelectItem>
                            {documents
                              .filter((document) => document.id === currentValue || !selectedDocumentIds.has(document.id))
                              .map((document) => (
                                <SelectItem key={document.id} value={document.id}>{document.title}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={bulkOverwriting} onClick={closeBulkOverwriteDialog}>
              Cancel
            </Button>
            <Button data-dialog-confirm="true" type="button" variant="outline-success" disabled={bulkOverwriting || bulkOverwriteFiles.length === 0} onClick={() => void applyBulkOverwrite()}>
              {bulkOverwriting ? 'Saving...' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={(open) => !saving && setEditorOpen(open)}>
        <DialogContent aria-describedby={undefined} className="w-screen max-w-none rounded-none sm:w-full sm:max-w-3xl sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>{editingDocument ? 'Edit Document' : 'Add Document'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="corpus-document-title">Title</Label>
              <Input id="corpus-document-title" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
            </div>
            {hasTags && (
              <div className="space-y-2">
                <Label>Tags</Label>
                <MultiSelectFilter
                  label="Tags"
                  options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
                  selectedValues={draftTagIds}
                  onSelectedValuesChange={setDraftTagIds}
                  allLabel="All Tags"
                  noneLabel="No Tags"
                  triggerClassName="h-9 w-full"
                  showBulkActions={false}
                />
              </div>
            )}
            <div className="space-y-2">
              <LabelWithAside htmlFor="corpus-document-content" aside="Markdown Supported">Content</LabelWithAside>
              <MarkdownSyntaxTextarea
                id="corpus-document-content"
                value={draftContent}
                onChange={setDraftContent}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</Button>
            <Button data-dialog-confirm="true" type="button" variant="outline-success" onClick={() => void saveEditor()} disabled={saving || !draftTitle.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody>
            <AlertDialogDescription>This document will no longer be available through Corpus or the MCP server.</AlertDialogDescription>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return;
                void onDeleteDocument(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
