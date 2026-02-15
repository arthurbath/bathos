import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Category } from '@/hooks/useCategories';
import type { Expense } from '@/hooks/useExpenses';

interface CategoriesTabProps {
  categories: Category[];
  expenses: Expense[];
  onAdd: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onReassignExpenses: (oldCategoryId: string, newCategoryId: string | null) => Promise<void>;
}

export function CategoriesTab({ categories, expenses, onAdd, onUpdate, onRemove, onReassignExpenses }: CategoriesTabProps) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('_none');
  const editRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await onAdd(name.trim());
      setName('');
    } catch (e: any) {
      toast({ title: 'Error adding category', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditValue(cat.name);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const commitEdit = async () => {
    if (editingId && editValue.trim() && editValue.trim() !== categories.find(c => c.id === editingId)?.name) {
      try {
        await onUpdate(editingId, editValue.trim());
      } catch (e: any) {
        toast({ title: 'Error renaming', description: e.message, variant: 'destructive' });
      }
    }
    setEditingId(null);
  };

  const handleDeleteClick = (cat: Category) => {
    const usedByExpenses = expenses.filter(e => e.category_id === cat.id);
    if (usedByExpenses.length > 0) {
      setDeleteTarget(cat);
      setReassignTo('_none');
    } else {
      doDelete(cat.id);
    }
  };

  const doDelete = async (id: string) => {
    try {
      await onRemove(id);
    } catch (e: any) {
      toast({ title: 'Error removing category', description: e.message, variant: 'destructive' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onReassignExpenses(deleteTarget.id, reassignTo === '_none' ? null : reassignTo);
      await onRemove(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const affectedCount = deleteTarget ? expenses.filter(e => e.category_id === deleteTarget.id).length : 0;

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add Category</CardTitle>
            <CardDescription>Organize your expenses into categories.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Housing, Food, Transport"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <Button onClick={handleAdd} disabled={!name.trim() || adding} className="gap-1.5 shrink-0">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>{categories.length} categories</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No categories yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map(cat => {
                    const count = expenses.filter(e => e.category_id === cat.id).length;
                    return (
                      <TableRow key={cat.id}>
                        <TableCell>
                          {editingId === cat.id ? (
                            <Input
                              ref={editRef}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitEdit();
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="h-8"
                            />
                          ) : (
                            <span className="font-medium">{cat.name}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{count}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(cat)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost-destructive" size="icon" className="h-7 w-7" onClick={() => handleDeleteClick(cat)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>
              {affectedCount} expense{affectedCount !== 1 ? 's' : ''} use this category. Choose where to reassign them:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reassign to</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No category</SelectItem>
                {categories.filter(c => c.id !== deleteTarget?.id).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>Delete & Reassign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
