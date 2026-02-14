import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Pencil, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { COLOR_PALETTE } from '@/lib/colors';

interface ManagedItem {
  id: string;
  name: string;
  color?: string | null;
}

interface ManagedListSectionProps {
  title: string;
  description: string;
  items: ManagedItem[];
  getUsageCount: (id: string) => number;
  onAdd: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onReassign?: (oldId: string, newId: string | null) => Promise<void>;
  onUpdateColor?: (id: string, color: string | null) => Promise<void>;
}

function ColorPicker({ color, onChange }: { color: string | null | undefined; onChange: (c: string | null) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="h-6 w-6 rounded border border-border shrink-0 transition-shadow hover:ring-2 hover:ring-ring"
          style={{ backgroundColor: color || 'transparent' }}
          title="Pick color"
        >
          {!color && <span className="text-[10px] text-muted-foreground flex items-center justify-center h-full">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-6 gap-1.5">
          {COLOR_PALETTE.map(c => (
            <button
              key={c}
              className={`h-6 w-6 rounded border transition-shadow ${color === c ? 'ring-2 ring-ring border-ring' : 'border-border hover:ring-1 hover:ring-ring'}`}
              style={{ backgroundColor: c }}
              onClick={() => onChange(c)}
            />
          ))}
        </div>
        {color && (
          <button
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onChange(null)}
          >
            <X className="h-3 w-3" /> Remove color
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export { ColorPicker };

export function ManagedListSection({ title, description, items, getUsageCount, onAdd, onUpdate, onRemove, onReassign, onUpdateColor }: ManagedListSectionProps) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ManagedItem | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('_none');
  const editRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await onAdd(name.trim());
      setName('');
    } catch (e: any) {
      toast({ title: `Error adding ${title.toLowerCase()}`, description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const startEdit = (item: ManagedItem) => {
    setEditingId(item.id);
    setEditValue(item.name);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const commitEdit = async () => {
    if (editingId && editValue.trim() && editValue.trim() !== items.find(i => i.id === editingId)?.name) {
      try {
        await onUpdate(editingId, editValue.trim());
      } catch (e: any) {
        toast({ title: 'Error renaming', description: e.message, variant: 'destructive' });
      }
    }
    setEditingId(null);
  };

  const handleDeleteClick = (item: ManagedItem) => {
    const count = getUsageCount(item.id);
    if (count > 0 && onReassign) {
      setDeleteTarget(item);
      setReassignTo('_none');
    } else {
      doDelete(item.id);
    }
  };

  const doDelete = async (id: string) => {
    try {
      await onRemove(id);
    } catch (e: any) {
      toast({ title: 'Error removing', description: e.message, variant: 'destructive' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !onReassign) return;
    try {
      await onReassign(deleteTarget.id, reassignTo === '_none' ? null : reassignTo);
      await onRemove(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const affectedCount = deleteTarget ? getUsageCount(deleteTarget.id) : 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder={`Add new ${title.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '')}…`}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={!name.trim() || adding} className="gap-1.5 shrink-0" size="sm">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No {title.toLowerCase()} yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {onUpdateColor && <TableHead className="w-10">Color</TableHead>}
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => {
                  const count = getUsageCount(item.id);
                  return (
                    <TableRow key={item.id}>
                      {onUpdateColor && (
                        <TableCell>
                          <ColorPicker
                            color={item.color}
                            onChange={c => onUpdateColor(item.id, c)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {editingId === item.id ? (
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
                          <span className="font-medium">{item.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{count}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {count > 0 && onReassign ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteClick(item)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => doDelete(item.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>
              {affectedCount} expense{affectedCount !== 1 ? 's' : ''} use this. Choose where to reassign:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reassign to</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {items.filter(i => i.id !== deleteTarget?.id).map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
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
