import { useEffect, useMemo, useRef, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { FileUp, FilterX, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataGrid, GridEditableCell, gridMenuTriggerProps, useDataGrid } from '@/components/ui/data-grid';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';
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
  onSetDocumentTags: (documentId: string, tagIds: string[]) => Promise<void>;
  onDeleteDocument: (id: string) => Promise<void>;
}

const columnHelper = createColumnHelper<CorpusDocument>();
const HISTORY_KEY = 'corpus_documents';

function titleFromFilename(fileName: string) {
  return fileName.replace(/\.(md|markdown|txt)$/i, '').trim() || fileName;
}

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function TagCell({
  tags,
  options,
  onChange,
}: {
  tags: CorpusTag[];
  options: CorpusTag[];
  onChange: (tagIds: string[]) => void;
}) {
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
    />
  );
}

function ActionsCell({
  document,
  onEdit,
  onDelete,
  navCol,
}: {
  document: CorpusDocument;
  onEdit: (document: CorpusDocument) => void;
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
        <DropdownMenuItem onClick={() => onDelete(document)} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updated_at', desc: true }]);
  const [query, setQuery] = useState('');
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<CorpusDocument | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CorpusDocument | null>(null);
  const hasTags = tags.length > 0;

  useEffect(() => {
    if (hasTags) return;
    setSelectedTagFilters([]);
    setDraftTagIds([]);
  }, [hasTags]);

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
      return (
        document.title.toLocaleLowerCase().includes(normalizedQuery)
        || document.content.toLocaleLowerCase().includes(normalizedQuery)
        || (document.source_filename ?? '').toLocaleLowerCase().includes(normalizedQuery)
        || document.tags.some((tag) => tag.name.toLocaleLowerCase().includes(normalizedQuery))
      );
    });
  }, [documents, hasTags, query, selectedTagFilters]);

  const openNewEditor = () => {
    setEditingDocument(null);
    setDraftTitle('');
    setDraftContent('');
    setDraftTagIds([]);
    setEditorOpen(true);
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
          await onSetDocumentTags(editingDocument.id, draftTagIds);
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
    for (const file of supportedFiles) {
      const content = await file.text();
      await onAddDocument({
        title: titleFromFilename(file.name),
        content,
        content_type: 'markdown',
        source_filename: file.name,
        tagIds: [],
      });
    }
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: 'Title',
        size: CORPUS_DOCUMENTS_GRID_DEFAULT_WIDTHS.title,
        minSize: 160,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.title}
            navCol={0}
            onChange={(value) => onUpdateDocument(row.original.id, { title: value })}
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
                  onChange={(tagIds) => void onSetDocumentTags(row.original.id, tagIds)}
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
        cell: ({ row }) => <ActionsCell document={row.original} onEdit={openExistingEditor} onDelete={setDeleteTarget} navCol={hasTags ? 4 : 3} />,
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
      <Card className="max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0 border-t-0 md:border-t">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Documents</CardTitle>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-8 w-36 text-xs sm:w-40"
              aria-label="Search Documents"
            />
            {hasTags && (
              <MultiSelectFilter
                label="Tags"
                options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
                selectedValues={selectedTagFilters}
                onSelectedValuesChange={setSelectedTagFilters}
                allLabel="All Tags"
                noneLabel="No Tags"
                triggerClassName="w-36 sm:w-44"
              />
            )}
            <Button
              type="button"
              variant="outline-warning"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                setQuery('');
                setSelectedTagFilters([]);
              }}
              disabled={!hasFilters}
              aria-label="Clear filters"
            >
              <FilterX className="h-4 w-4" />
            </Button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              multiple
              className="hidden"
              onChange={(event) => void uploadFiles(event.target.files)}
            />
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => uploadInputRef.current?.click()}>
              <FileUp className="h-4 w-4" />
              Upload
            </Button>
            <Button type="button" variant="outline-success" size="sm" className="h-8 w-8 p-0" aria-label="Add document" onClick={openNewEditor}>
              <Plus className="h-4 w-4" />
            </Button>
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
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="corpus-document-content">Content (Markdown Supported)</Label>
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
            <AlertDialogDescription>This document will no longer be available through Corpus or the MCP server.</AlertDialogDescription>
          </AlertDialogHeader>
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
