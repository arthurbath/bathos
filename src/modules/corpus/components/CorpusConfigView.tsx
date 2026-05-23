import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { EyeOff, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyInputGroup } from '@/components/ui/copy-input-group';
import { DataGrid, GridEditableCell, gridMenuTriggerProps, useDataGrid } from '@/components/ui/data-grid';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { CORPUS_TAGS_GRID_DEFAULT_WIDTHS, GRID_FIXED_COLUMNS } from '@/lib/gridColumnWidths';
import type { CorpusAccessToken, CorpusDocument, CorpusTag } from '@/modules/corpus/types/corpus';

interface CorpusConfigViewProps {
  userId: string;
  tags: CorpusTag[];
  documents: CorpusDocument[];
  tokens: CorpusAccessToken[];
  newToken: string | null;
  onClearNewToken: () => void;
  onAddTag: (name: string, description?: string | null) => Promise<CorpusTag>;
  onUpdateTag: (id: string, updates: { name?: string; description?: string | null }) => Promise<CorpusTag>;
  onDeleteTag: (id: string) => Promise<void>;
  onCreateToken: (name: string) => Promise<string>;
  onRevokeToken: (id: string) => Promise<void>;
  onHideToken: (id: string) => Promise<void>;
}

const tagColumnHelper = createColumnHelper<CorpusTag>();
const MCP_URL = 'https://rsqfokyqntmtdejfwmjs.supabase.co/functions/v1/corpus-mcp';

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function TagActionsCell({ tag, onDelete }: { tag: CorpusTag; onDelete: (tag: CorpusTag) => void }) {
  const ctx = useDataGrid();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          type="button"
          className="float-right mr-[5px] h-7 w-7"
          aria-label={`Actions for ${tag.name}`}
          {...gridMenuTriggerProps(ctx, 3)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuItem onClick={() => onDelete(tag)} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CorpusConfigView({
  userId,
  tags,
  documents,
  tokens,
  newToken,
  onClearNewToken,
  onAddTag,
  onUpdateTag,
  onDeleteTag,
  onCreateToken,
  onRevokeToken,
  onHideToken,
}: CorpusConfigViewProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagDescription, setTagDescription] = useState('');
  const [savingTag, setSavingTag] = useState(false);
  const [deleteTagTarget, setDeleteTagTarget] = useState<CorpusTag | null>(null);
  const [createTokenOpen, setCreateTokenOpen] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<CorpusAccessToken | null>(null);
  const [hideTarget, setHideTarget] = useState<CorpusAccessToken | null>(null);

  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'corpus_tags',
    defaults: CORPUS_TAGS_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.corpus_tags,
  });

  const usageByTagId = useMemo(() => {
    const usage: Record<string, number> = {};
    for (const document of documents) {
      for (const tag of document.tags) {
        usage[tag.id] = (usage[tag.id] ?? 0) + 1;
      }
    }
    return usage;
  }, [documents]);

  const columns = useMemo(
    () => [
      tagColumnHelper.accessor('name', {
        header: 'Name',
        size: CORPUS_TAGS_GRID_DEFAULT_WIDTHS.name,
        minSize: 160,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.name}
            navCol={0}
            onChange={(value) => onUpdateTag(row.original.id, { name: value })}
          />
        ),
      }),
      tagColumnHelper.accessor('description', {
        header: 'Description',
        size: CORPUS_TAGS_GRID_DEFAULT_WIDTHS.description,
        minSize: 220,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.description ?? ''}
            navCol={1}
            deleteResetValue=""
            onChange={(value) => onUpdateTag(row.original.id, { description: value.trim() || null })}
          />
        ),
      }),
      tagColumnHelper.accessor((row) => usageByTagId[row.id] ?? 0, {
        id: 'documents',
        header: 'Documents',
        size: CORPUS_TAGS_GRID_DEFAULT_WIDTHS.documents,
        minSize: 100,
        meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums text-xs' },
        cell: ({ getValue }) => getValue(),
      }),
      tagColumnHelper.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        enableResizing: false,
        size: CORPUS_TAGS_GRID_DEFAULT_WIDTHS.actions,
        minSize: CORPUS_TAGS_GRID_DEFAULT_WIDTHS.actions,
        maxSize: CORPUS_TAGS_GRID_DEFAULT_WIDTHS.actions,
        meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
        cell: ({ row }) => <TagActionsCell tag={row.original} onDelete={setDeleteTagTarget} />,
      }),
    ],
    [onUpdateTag, usageByTagId],
  );

  const table = useReactTable({
    data: tags,
    columns,
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

  const addTag = async () => {
    if (savingTag) return;
    setSavingTag(true);
    try {
      await onAddTag(tagName, tagDescription.trim() || null);
      setAddTagOpen(false);
      setTagName('');
      setTagDescription('');
    } catch (error) {
      toast({ title: 'Failed to Add Tag', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSavingTag(false);
    }
  };

  const createToken = async () => {
    if (creatingToken) return;
    setCreatingToken(true);
    try {
      await onCreateToken(tokenName);
      setTokenName('');
      setCreateTokenOpen(false);
    } catch (error) {
      toast({ title: 'Failed to Create Token', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setCreatingToken(false);
    }
  };

  const openCreateTokenDialog = () => {
    setTokenName('');
    setCreateTokenOpen(true);
  };

  const closeCreateTokenDialog = () => {
    setTokenName('');
    setCreateTokenOpen(false);
  };
  const hasTokens = tokens.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Tags</CardTitle>
          <Button type="button" variant="outline-success" size="sm" className="h-8 w-8 p-0" aria-label="Add tag" onClick={() => setAddTagOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-2.5">
          <DataGrid table={table} historyKey="corpus_tags" maxHeight="none" stickyFirstColumn={false} emptyMessage="No tags yet." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>MCP Access</CardTitle>
          {hasTokens && (
            <Button
              type="button"
              variant="outline-success"
              size="sm"
              className="h-8 gap-1.5"
              onClick={openCreateTokenDialog}
            >
              <Plus className="h-4 w-4" />
              Create Token
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasTokens ? (
            <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
              <div className="max-w-xl space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Create a Token to Connect an AI</h3>
                <p className="text-sm text-muted-foreground">
                  Tokens let AI agents read your Corpus documents.
                </p>
              </div>
              <Button
                type="button"
                variant="outline-success"
                className="gap-1.5"
                onClick={openCreateTokenDialog}
              >
                <Plus className="h-4 w-4" />
                Create Token
              </Button>
            </div>
          ) : (
            <>
              <CopyInputGroup readOnly value={MCP_URL} aria-label="MCP URL" buttonAriaLabel="Copy MCP URL" />

              <div className="space-y-2">
                {tokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{token.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Created {formatDate(token.created_at)} · Last Used {formatDate(token.last_used_at)}
                      {token.revoked_at ? ` · Revoked ${formatDate(token.revoked_at)}` : ''}
                    </div>
                  </div>
                  {token.revoked_at ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => setHideTarget(token)}
                    >
                      <EyeOff className="h-4 w-4" />
                      Hide
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline-destructive"
                      size="sm"
                      className="h-8"
                      onClick={() => setRevokeTarget(token)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={addTagOpen} onOpenChange={(open) => !savingTag && setAddTagOpen(open)}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="corpus-tag-name">Name</Label>
              <Input id="corpus-tag-name" value={tagName} onChange={(event) => setTagName(event.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="corpus-tag-description">Description</Label>
              <Textarea id="corpus-tag-description" value={tagDescription} onChange={(event) => setTagDescription(event.target.value)} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={savingTag} onClick={() => setAddTagOpen(false)}>Cancel</Button>
            <Button data-dialog-confirm="true" type="button" variant="outline-success" disabled={savingTag || !tagName.trim()} onClick={() => void addTag()}>
              {savingTag ? 'Saving...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createTokenOpen} onOpenChange={(open) => !creatingToken && (open ? openCreateTokenDialog() : closeCreateTokenDialog())}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Create Token</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="corpus-token-name">Name</Label>
              <Input
                id="corpus-token-name"
                value={tokenName}
                onChange={(event) => setTokenName(event.target.value)}
                placeholder="Codex"
                autoFocus
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={creatingToken} onClick={closeCreateTokenDialog}>Cancel</Button>
            <Button data-dialog-confirm="true" type="button" variant="outline-success" disabled={creatingToken || !tokenName.trim()} onClick={() => void createToken()}>
              {creatingToken ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newToken} onOpenChange={(open) => !open && onClearNewToken()}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Token Created</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy or write down this token now. It will not be shown again, but you can revoke it at any time from the MCP Access list.
            </p>
            <div className="space-y-2">
              <Label htmlFor="corpus-token-mcp-url">MCP URL</Label>
              <CopyInputGroup id="corpus-token-mcp-url" readOnly value={MCP_URL} aria-label="MCP URL" buttonAriaLabel="Copy MCP URL" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="corpus-new-token">New Token</Label>
              <CopyInputGroup id="corpus-new-token" readOnly value={newToken ?? ''} aria-label="New Token" buttonAriaLabel="Copy New Token" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button data-dialog-confirm="true" type="button" variant="outline" onClick={onClearNewToken}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTagTarget} onOpenChange={(open) => !open && setDeleteTagTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTagTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Documents will keep their content but lose this tag.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTagTarget) return;
                void onDeleteTag(deleteTagTarget.id);
                setDeleteTagTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke "{revokeTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Agents using this token will lose access to Corpus.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!revokeTarget) return;
                void onRevokeToken(revokeTarget.id);
                setRevokeTarget(null);
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hideTarget} onOpenChange={(open) => !open && setHideTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hide "{hideTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This revoked token will be removed from this list. It will remain revoked and cannot be used.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!hideTarget) return;
                void onHideToken(hideTarget.id);
                setHideTarget(null);
              }}
            >
              Hide
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
