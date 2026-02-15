import { useState } from 'react';
import { ManagedListSection, ColorPicker } from '@/components/ManagedListSection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Users, Copy, Check, Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Category } from '@/hooks/useCategories';
import type { Budget } from '@/hooks/useBudgets';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import type { Expense } from '@/hooks/useExpenses';

interface ConfigurationTabProps {
  categories: Category[];
  budgets: Budget[];
  linkedAccounts: LinkedAccount[];
  expenses: Expense[];
  partnerX: string;
  partnerY: string;
  partnerXColor: string | null;
  partnerYColor: string | null;
  inviteCode: string | null;
  onUpdatePartnerNames: (x: string, y: string) => Promise<void>;
  onUpdatePartnerColors: (xColor: string | null, yColor: string | null) => Promise<void>;
  onAddCategory: (name: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string) => Promise<void>;
  onRemoveCategory: (id: string) => Promise<void>;
  onReassignCategory: (oldId: string, newId: string | null) => Promise<void>;
  onUpdateCategoryColor: (id: string, color: string | null) => Promise<void>;
  onAddBudget: (name: string) => Promise<void>;
  onUpdateBudget: (id: string, name: string) => Promise<void>;
  onRemoveBudget: (id: string) => Promise<void>;
  onReassignBudget: (oldId: string, newId: string | null) => Promise<void>;
  onUpdateBudgetColor: (id: string, color: string | null) => Promise<void>;
  onAddLinkedAccount: (name: string, ownerPartner?: string) => Promise<void>;
  onUpdateLinkedAccount: (id: string, updates: Partial<Pick<LinkedAccount, 'name' | 'owner_partner'>>) => Promise<void>;
  onRemoveLinkedAccount: (id: string) => Promise<void>;
  onReassignLinkedAccount: (oldId: string, newId: string | null) => Promise<void>;
  onUpdateLinkedAccountColor: (id: string, color: string | null) => Promise<void>;
  onSyncPayerForAccount: (accountId: string, ownerPartner: string) => Promise<void>;
}

function PartnerNamesCard({ partnerX, partnerY, partnerXColor, partnerYColor, onSave, onUpdateColors }: {
  partnerX: string;
  partnerY: string;
  partnerXColor: string | null;
  partnerYColor: string | null;
  onSave: (x: string, y: string) => Promise<void>;
  onUpdateColors: (xColor: string | null, yColor: string | null) => Promise<void>;
}) {
  const [nameX, setNameX] = useState(partnerX);
  const [nameY, setNameY] = useState(partnerY);
  const [saving, setSaving] = useState(false);
  const dirty = nameX !== partnerX || nameY !== partnerY;

  const handleSave = async () => {
    if (!nameX.trim() || !nameY.trim()) return;
    setSaving(true);
    try {
      await onSave(nameX.trim(), nameY.trim());
      toast({ title: 'Partner names updated' });
    } catch (e: any) {
      toast({ title: 'Failed to update', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Partner Names</CardTitle>
        
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Partner X</label>
            <div className="flex items-center gap-2">
              <ColorPicker color={partnerXColor} onChange={c => onUpdateColors(c, partnerYColor)} />
              <Input value={nameX} onChange={e => setNameX(e.target.value)} placeholder="e.g. Alice" className="flex-1" />
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Partner Y</label>
            <div className="flex items-center gap-2">
              <ColorPicker color={partnerYColor} onChange={c => onUpdateColors(partnerXColor, c)} />
              <Input value={nameY} onChange={e => setNameY(e.target.value)} placeholder="e.g. Bob" className="flex-1" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={!dirty || saving || !nameX.trim() || !nameY.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InviteCard({ inviteCode }: { inviteCode: string | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast({ title: 'Invite code copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Invite Collaborators</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            readOnly
            value={inviteCode ?? 'Generating...'}
            className="font-mono text-lg tracking-widest text-center"
          />
          <Button variant="outline" size="icon" onClick={handleCopy} disabled={!inviteCode}>
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentMethodsSection({ linkedAccounts, expenses, partnerX, partnerY, onAdd, onUpdate, onRemove, onReassign, onSyncPayer, onUpdateColor }: {
  linkedAccounts: LinkedAccount[];
  expenses: Expense[];
  partnerX: string;
  partnerY: string;
  onAdd: (name: string, ownerPartner?: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Pick<LinkedAccount, 'name' | 'owner_partner'>>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onReassign: (oldId: string, newId: string | null) => Promise<void>;
  onSyncPayer: (accountId: string, ownerPartner: string) => Promise<void>;
  onUpdateColor: (id: string, color: string | null) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [ownerPartner, setOwnerPartner] = useState('X');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LinkedAccount | null>(null);
  const [reassignTo, setReassignTo] = useState('_none');

  const getUsageCount = (id: string) => expenses.filter(e => e.linked_account_id === id).length;

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await onAdd(name.trim(), ownerPartner);
      setName('');
    } catch (e: any) {
      toast({ title: 'Error adding payment method', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const commitEdit = async () => {
    if (editingId && editValue.trim()) {
      const current = linkedAccounts.find(i => i.id === editingId);
      if (current && editValue.trim() !== current.name) {
        try { await onUpdate(editingId, { name: editValue.trim() }); } catch (e: any) {
          toast({ title: 'Error renaming', description: e.message, variant: 'destructive' });
        }
      }
    }
    setEditingId(null);
  };

  const handleOwnerChange = async (id: string, newOwner: string) => {
    try {
      await onUpdate(id, { owner_partner: newOwner });
      await onSyncPayer(id, newOwner);
    } catch (e: any) {
      toast({ title: 'Error updating owner', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteClick = (item: LinkedAccount) => {
    const count = getUsageCount(item.id);
    if (count > 0) {
      setDeleteTarget(item);
      setReassignTo('_none');
    } else {
      onRemove(item.id).catch((e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
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
          <CardTitle>Payment Methods</CardTitle>
          
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add new payment method…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="flex-1"
            />
            <Select value={ownerPartner} onValueChange={setOwnerPartner}>
              <SelectTrigger className="w-32 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="X">{partnerX}</SelectItem>
                <SelectItem value="Y">{partnerY}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!name.trim() || adding} className="gap-1.5 shrink-0" size="sm">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          {linkedAccounts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No payment methods yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedAccounts.map(item => {
                  const count = getUsageCount(item.id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <ColorPicker color={item.color} onChange={c => onUpdateColor(item.id, c)} />
                      </TableCell>
                      <TableCell>
                        {editingId === item.id ? (
                          <Input
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                            className="h-8"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium">{item.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select value={item.owner_partner} onValueChange={v => handleOwnerChange(item.id, v)}>
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="X">{partnerX}</SelectItem>
                            <SelectItem value="Y">{partnerY}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{count}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(item.id); setEditValue(item.name); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {count > 0 ? (
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
                                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onRemove(item.id)}>Delete</AlertDialogAction>
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
                {linkedAccounts.filter(i => i.id !== deleteTarget?.id).map(i => (
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

export function ConfigurationTab({
  categories, budgets, linkedAccounts, expenses,
  partnerX, partnerY, partnerXColor, partnerYColor, inviteCode,
  onUpdatePartnerNames, onUpdatePartnerColors,
  onAddCategory, onUpdateCategory, onRemoveCategory, onReassignCategory, onUpdateCategoryColor,
  onAddBudget, onUpdateBudget, onRemoveBudget, onReassignBudget, onUpdateBudgetColor,
  onAddLinkedAccount, onUpdateLinkedAccount, onRemoveLinkedAccount, onReassignLinkedAccount, onUpdateLinkedAccountColor,
  onSyncPayerForAccount,
}: ConfigurationTabProps) {
  return (
    <div className="space-y-6">
      <PartnerNamesCard partnerX={partnerX} partnerY={partnerY} partnerXColor={partnerXColor} partnerYColor={partnerYColor} onSave={onUpdatePartnerNames} onUpdateColors={onUpdatePartnerColors} />
      <InviteCard inviteCode={inviteCode} />
      <ManagedListSection
        title="Categories"
        description="Organize expenses into categories."
        items={categories}
        getUsageCount={(id) => expenses.filter(e => e.category_id === id).length}
        onAdd={onAddCategory}
        onUpdate={onUpdateCategory}
        onRemove={onRemoveCategory}
        onReassign={onReassignCategory}
        onUpdateColor={onUpdateCategoryColor}
      />
      <ManagedListSection
        title="Budgets"
        description="Define budget buckets like Fixed Essentials, Flexible, etc."
        items={budgets}
        getUsageCount={(id) => expenses.filter(e => e.budget_id === id).length}
        onAdd={onAddBudget}
        onUpdate={onUpdateBudget}
        onRemove={onRemoveBudget}
        onReassign={onReassignBudget}
        onUpdateColor={onUpdateBudgetColor}
      />
      <PaymentMethodsSection
        linkedAccounts={linkedAccounts}
        expenses={expenses}
        partnerX={partnerX}
        partnerY={partnerY}
        onAdd={onAddLinkedAccount}
        onUpdate={onUpdateLinkedAccount}
        onRemove={onRemoveLinkedAccount}
        onReassign={onReassignLinkedAccount}
        onSyncPayer={onSyncPayerForAccount}
        onUpdateColor={onUpdateLinkedAccountColor}
      />
    </div>
  );
}
