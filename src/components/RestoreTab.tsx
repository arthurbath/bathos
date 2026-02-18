import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Save, Trash2, RotateCcw, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import type { RestorePoint } from '@/hooks/useRestorePoints';
import type { Income } from '@/hooks/useIncomes';
import type { Expense } from '@/hooks/useExpenses';
import type { Category } from '@/hooks/useCategories';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import type { Json } from '@/integrations/supabase/types';

interface RestoreTabProps {
  points: RestorePoint[];
  incomes: Income[];
  expenses: Expense[];
  categories: Category[];
  linkedAccounts: LinkedAccount[];
  onSave: (notes: string, snapshot: Json) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
  onRestore: (data: Json) => Promise<void>;
}

export function RestoreTab({ points, incomes, expenses, categories, linkedAccounts, onSave, onRemove, onUpdateNotes, onRestore }: RestoreTabProps) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<RestorePoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RestorePoint | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState('');
  const formatTimestamp = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      const snapshot: Json = {
        incomes: incomes.map(({ id, name, amount, frequency_type, frequency_param, partner_label }) =>
          ({ id, name, amount, frequency_type, frequency_param, partner_label })
        ) as unknown as Json,
        expenses: expenses.map(({
          id,
          name,
          amount,
          frequency_type,
          frequency_param,
          payer,
          benefit_x,
          category_id,
          linked_account_id,
          budget_id,
          is_estimate,
        }) =>
          ({ id, name, amount, frequency_type, frequency_param, payer, benefit_x, category_id, linked_account_id, budget_id, is_estimate })
        ) as unknown as Json,
        categories: categories.map(({ id, name, color }) => ({ id, name, color })) as unknown as Json,
        linkedAccounts: linkedAccounts.map(({ id, name, color, owner_partner }) => ({ id, name, color, owner_partner })) as unknown as Json,
      };
      await onSave(notes.trim(), snapshot);
      setNotes('');
      toast({ title: 'Snapshot saved' });
    } catch (e: any) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    try {
      await onRestore(restoreTarget.data);
      toast({ title: 'Restored', description: `Restored from ${formatTimestamp(restoreTarget.created_at)}` });
    } catch (e: any) {
      toast({ title: 'Error restoring', description: e.message, variant: 'destructive' });
    }
    setRestoreTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onRemove(deleteTarget.id);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

  const startEditingNotes = (point: RestorePoint) => {
    setEditingNotesId(point.id);
    setEditingNotesValue(point.notes ?? '');
  };

  const cancelEditingNotes = () => {
    setEditingNotesId(null);
    setEditingNotesValue('');
  };

  const commitNotesEdit = async () => {
    if (!editingNotesId) return;
    const point = points.find((p) => p.id === editingNotesId);
    const next = editingNotesValue.trim();
    const current = point?.notes?.trim() ?? '';
    if (next === current) {
      cancelEditingNotes();
      return;
    }
    try {
      await onUpdateNotes(editingNotesId, next);
      toast({ title: 'Notes updated' });
    } catch (e: any) {
      toast({ title: 'Error updating notes', description: e.message, variant: 'destructive' });
    }
    cancelEditingNotes();
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Save Snapshot</CardTitle>
            
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
              <Button onClick={handleSave} disabled={saving} className="gap-1.5 shrink-0">
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backups</CardTitle>
            
          </CardHeader>
          <CardContent>
            {points.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No backups yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {points.map(pt => (
                    <TableRow key={pt.id} className="hover:bg-transparent">
                      <TableCell className="font-medium">{formatTimestamp(pt.created_at)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {editingNotesId === pt.id ? (
                          <Input
                            value={editingNotesValue}
                            onChange={(e) => setEditingNotesValue(e.target.value)}
                            onBlur={() => { void commitNotesEdit(); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void commitNotesEdit();
                              }
                              if (e.key === 'Escape') {
                                cancelEditingNotes();
                              }
                            }}
                            autoFocus
                            className="h-7 w-full rounded-md border border-transparent bg-transparent px-1 text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 cursor-pointer hover:border-border focus:border-transparent focus:ring-2 focus:ring-ring"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditingNotes(pt)}
                            className="h-7 w-full rounded-md border border-transparent bg-transparent px-1 text-left text-xs underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 cursor-pointer hover:border-border"
                          >
                            {pt.notes?.trim() || '—'}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="w-12 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 cursor-pointer hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
                              aria-label="Backup actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => setRestoreTarget(pt)}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Restore
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteTarget(pt)} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!restoreTarget} onOpenChange={open => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore snapshot from {restoreTarget ? formatTimestamp(restoreTarget.created_at) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all your current categories, incomes, and expenses with the data from this snapshot. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete backup from {deleteTarget ? formatTimestamp(deleteTarget.created_at) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the backup. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
