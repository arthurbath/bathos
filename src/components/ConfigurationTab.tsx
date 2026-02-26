import { forwardRef, useEffect, useMemo, useState, type ComponentPropsWithoutRef, type KeyboardEventHandler, type MouseEventHandler } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { ManagedListSection, ColorPicker } from '@/components/ManagedListSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataGrid, GridEditableCell, gridMenuTriggerProps, useDataGrid } from '@/components/ui/data-grid';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Copy, Check, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import type { Category } from '@/hooks/useCategories';
import { RestoreTab } from '@/components/RestoreTab';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import type { Expense } from '@/hooks/useExpenses';
import type { Income } from '@/hooks/useIncomes';
import type { RestorePoint } from '@/hooks/useRestorePoints';
import type { Json } from '@/integrations/supabase/types';
import { CONFIG_PAYMENT_METHODS_GRID_DEFAULT_WIDTHS, GRID_ACTIONS_COLUMN_ID, GRID_FIXED_COLUMNS, GRID_MIN_COLUMN_WIDTH } from '@/lib/gridColumnWidths';

interface ConfigurationTabProps {
  userId?: string;
  categories: Category[];
  categoryPendingById?: Record<string, boolean>;
  linkedAccounts: LinkedAccount[];
  linkedAccountPendingById?: Record<string, boolean>;
  expenses: Expense[];
  partnerX: string;
  partnerY: string;
  inviteCode: string | null;
  onUpdatePartnerNames: (x: string, y: string) => Promise<void>;
  onAddCategory: (name: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string) => Promise<void>;
  onRemoveCategory: (id: string) => Promise<void>;
  onReassignCategory: (oldId: string, newId: string | null) => Promise<void>;
  onUpdateCategoryColor: (id: string, color: string | null) => Promise<void>;
  onAddLinkedAccount: (name: string, ownerPartner?: string) => Promise<void>;
  onUpdateLinkedAccount: (id: string, updates: Partial<Pick<LinkedAccount, 'name' | 'owner_partner'>>) => Promise<void>;
  onRemoveLinkedAccount: (id: string) => Promise<void>;
  onReassignLinkedAccount: (oldId: string, newId: string | null) => Promise<void>;
  onUpdateLinkedAccountColor: (id: string, color: string | null) => Promise<void>;
  points: RestorePoint[];
  incomes: Income[];
  onSaveRestorePoint: (notes: string, snapshot: Json) => Promise<void>;
  onRemoveRestorePoint: (id: string) => Promise<void>;
  onUpdateRestorePointNotes: (id: string, notes: string) => Promise<void>;
  onRestore: (data: Json) => Promise<void>;
}

const paymentMethodColumnHelper = createColumnHelper<LinkedAccount>();
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';
const PAYMENT_METHOD_ACTIONS_NAV_COL = 3;

function PartnerNamesCard({ partnerX, partnerY, onSave }: {
  partnerX: string;
  partnerY: string;
  onSave: (x: string, y: string) => Promise<void>;
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
        <CardTitle>Partner Names</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Partner A</label>
            <Input value={nameX} onChange={e => setNameX(e.target.value)} placeholder="e.g. Alice" className="flex-1" />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Partner B</label>
            <Input value={nameY} onChange={e => setNameY(e.target.value)} placeholder="e.g. Bob" className="flex-1" />
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
        <CardTitle>Invite Collaborators</CardTitle>
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

function PaymentMethodOwnerCell({
  account,
  partnerX,
  partnerY,
  disabled,
  onChange,
}: {
  account: LinkedAccount;
  partnerX: string;
  partnerY: string;
  disabled: boolean;
  onChange: (owner: string) => void;
}) {
  const ctx = useDataGrid();

  return (
    <Select
      value={account.owner_partner}
      onValueChange={(value) => {
        ctx?.onCellCommit(2);
        onChange(value);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        disabled={disabled}
        className={`h-7 w-full min-w-[92px] border-transparent bg-transparent hover:border-[hsl(var(--grid-sticky-line))] text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 ${GRID_CONTROL_FOCUS_CLASS}`}
        data-row={ctx?.rowIndex}
        data-row-id={ctx?.rowId}
        data-col={2}
        onMouseDown={ctx?.onCellMouseDown}
        onKeyDown={(event) => {
          if (!ctx) return;
          const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
          if (expanded) return;
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Tab') {
            ctx.onCellKeyDown(event);
          }
        }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="X">{partnerX}</SelectItem>
        <SelectItem value="Y">{partnerY}</SelectItem>
      </SelectContent>
    </Select>
  );
}

type PaymentMethodActionsTriggerProps = ComponentPropsWithoutRef<typeof Button> & {
  ariaLabel: string;
};

const PaymentMethodActionsTrigger = forwardRef<HTMLButtonElement, PaymentMethodActionsTriggerProps>(function PaymentMethodActionsTrigger({
  ariaLabel,
  onKeyDown,
  onMouseDown,
  ...props
}, ref) {
  const ctx = useDataGrid();
  const navProps = gridMenuTriggerProps(ctx, PAYMENT_METHOD_ACTIONS_NAV_COL) as ComponentPropsWithoutRef<typeof Button>;

  const handleKeyDown: KeyboardEventHandler<HTMLButtonElement> = (event) => {
    (navProps.onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined)?.(event);
    if (!event.defaultPrevented) {
      onKeyDown?.(event);
    }
  };

  const handleMouseDown: MouseEventHandler<HTMLButtonElement> = (event) => {
    (navProps.onMouseDown as MouseEventHandler<HTMLButtonElement> | undefined)?.(event);
    if (!event.defaultPrevented) {
      onMouseDown?.(event);
    }
  };

  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      type="button"
      className={`float-right mr-[5px] h-7 w-7 ${GRID_CONTROL_FOCUS_CLASS}`}
      aria-label={ariaLabel}
      {...props}
      {...navProps}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
    >
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  );
});

function PaymentMethodsSection({ userId, linkedAccounts, expenses, partnerX, partnerY, onAdd, onUpdate, onRemove, onReassign, onUpdateColor, pendingById = {} }: {
  userId?: string;
  linkedAccounts: LinkedAccount[];
  expenses: Expense[];
  partnerX: string;
  partnerY: string;
  onAdd: (name: string, ownerPartner?: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Pick<LinkedAccount, 'name' | 'owner_partner'>>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onReassign: (oldId: string, newId: string | null) => Promise<void>;
  onUpdateColor: (id: string, color: string | null) => Promise<void>;
  pendingById?: Record<string, boolean>;
}) {
  const [name, setName] = useState('');
  const [ownerPartner, setOwnerPartner] = useState('X');
  const [adding, setAdding] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LinkedAccount | null>(null);
  const [reassignTo, setReassignTo] = useState('_none');

  const [sorting, setSorting] = useState<SortingState>(() => {
    if (typeof window === 'undefined') return [{ id: 'name', desc: false }];
    try {
      const raw = window.localStorage.getItem('config_payment_methods_sorting');
      return raw ? JSON.parse(raw) : [{ id: 'name', desc: false }];
    } catch {
      return [{ id: 'name', desc: false }];
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('config_payment_methods_sorting', JSON.stringify(sorting));
  }, [sorting]);

  const {
    columnSizing,
    columnSizingInfo,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'config_payment_methods',
    defaults: CONFIG_PAYMENT_METHODS_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.config_payment_methods,
  });

  const getUsageCount = (id: string) => expenses.filter(e => e.linked_account_id === id).length;

  const handleAdd = async () => {
    const nextName = name.trim();
    if (!nextName) return;
    setAdding(true);
    try {
      await onAdd(nextName, ownerPartner);
      setName('');
      setOwnerPartner('X');
      setAddDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'Error adding payment method', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleRename = async (id: string, nextRaw: string) => {
    const nextName = nextRaw.trim();
    const current = linkedAccounts.find(item => item.id === id)?.name ?? '';
    if (!nextName || nextName === current) return;
    try {
      await onUpdate(id, { name: nextName });
    } catch (e: any) {
      toast({ title: 'Error renaming', description: e.message, variant: 'destructive' });
    }
  };

  const handleOwnerChange = async (id: string, newOwner: string) => {
    try {
      await onUpdate(id, { owner_partner: newOwner });
    } catch (e: any) {
      toast({ title: 'Error updating owner', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteClick = (item: LinkedAccount) => {
    if (pendingById[item.id]) return;
    const count = getUsageCount(item.id);
    if (count > 0) {
      setDeleteTarget(item);
      setReassignTo('_none');
      return;
    }
    void onRemove(item.id).catch((e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }));
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onReassign(deleteTarget.id, reassignTo === '_none' ? null : reassignTo);
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const affectedCount = deleteTarget ? getUsageCount(deleteTarget.id) : 0;
  const columns = useMemo(
    () => [
      paymentMethodColumnHelper.accessor('name', {
        id: 'name',
        header: 'Name',
        size: 300,
        minSize: GRID_MIN_COLUMN_WIDTH,
        meta: { containsEditableInput: true },
        cell: ({ row }) => {
          const item = row.original;
          const isPending = !!pendingById[item.id];
          return (
            <GridEditableCell
              value={item.name}
              navCol={0}
              disabled={isPending}
              onChange={(nextValue) => {
                void handleRename(item.id, nextValue);
              }}
            />
          );
        },
      }),
      paymentMethodColumnHelper.display({
        id: 'color',
        header: 'Color',
        size: GRID_MIN_COLUMN_WIDTH,
        minSize: GRID_MIN_COLUMN_WIDTH,
        meta: { containsButton: true },
        cell: ({ row }) => {
          const item = row.original;
          const isPending = !!pendingById[item.id];
          return (
            <ColorPicker
              color={item.color}
              disabled={isPending}
              navCol={1}
              onChange={(nextColor) => {
                void onUpdateColor(item.id, nextColor);
              }}
            />
          );
        },
      }),
      paymentMethodColumnHelper.accessor('owner_partner', {
        id: 'owner',
        header: 'Owner',
        size: 130,
        minSize: GRID_MIN_COLUMN_WIDTH,
        meta: { containsEditableInput: true },
        cell: ({ row }) => {
          const item = row.original;
          const isPending = !!pendingById[item.id];
          return (
            <PaymentMethodOwnerCell
              account={item}
              partnerX={partnerX}
              partnerY={partnerY}
              disabled={isPending}
              onChange={(nextOwner) => {
                void handleOwnerChange(item.id, nextOwner);
              }}
            />
          );
        },
      }),
      paymentMethodColumnHelper.accessor((row) => getUsageCount(row.id), {
        id: 'expenses',
        header: 'Expenses',
        size: 110,
        minSize: GRID_MIN_COLUMN_WIDTH,
        meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums text-xs' },
        cell: ({ getValue }) => getValue(),
      }),
      paymentMethodColumnHelper.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        enableResizing: false,
        size: CONFIG_PAYMENT_METHODS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        minSize: CONFIG_PAYMENT_METHODS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        maxSize: CONFIG_PAYMENT_METHODS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
        meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
        cell: ({ row }) => {
          const item = row.original;
          const isPending = !!pendingById[item.id];
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <PaymentMethodActionsTrigger
                  ariaLabel={`Actions for ${item.name}`}
                  disabled={isPending}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => handleDeleteClick(item)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    [getUsageCount, handleDeleteClick, handleOwnerChange, handleRename, onUpdateColor, partnerX, partnerY, pendingById],
  );

  const table = useReactTable({
    data: linkedAccounts,
    columns,
    defaultColumn: { minSize: GRID_MIN_COLUMN_WIDTH },
    state: { sorting, columnSizing, columnSizingInfo },
    enableColumnResizing: true,
    onSortingChange: setSorting,
    onColumnSizingChange,
    onColumnSizingInfoChange,
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Methods</CardTitle>
            <Button
              onClick={() => {
                if (adding) return;
                setName('');
                setOwnerPartner('X');
                setAddDialogOpen(true);
              }}
              disabled={adding}
              variant="outline-success"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Add payment method"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2.5">
          {linkedAccounts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No payment methods yet.</p>
          ) : (
            <DataGrid table={table} maxHeight="none" stickyFirstColumn={false} />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          if (!open && !adding) {
            setAddDialogOpen(false);
            setName('');
            setOwnerPartner('X');
            return;
          }
          if (open) setAddDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add payment method</DialogTitle>
            <DialogDescription>Add a new payment method and assign an owner partner.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-payment-method-name">Name</Label>
              <Input
                id="new-payment-method-name"
                value={name}
                autoFocus
                disabled={adding}
                placeholder="New payment method name"
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleAdd();
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={ownerPartner} onValueChange={setOwnerPartner}>
                <SelectTrigger className="w-full" disabled={adding}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="X">{partnerX}</SelectItem>
                  <SelectItem value="Y">{partnerY}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setName('');
                setOwnerPartner('X');
              }}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button variant="outline-success" onClick={() => void handleAdd()} disabled={adding || !name.trim()}>
              {adding ? 'Saving...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>
              {affectedCount} expense{affectedCount !== 1 ? 's' : ''} use this. Choose where to reassign:
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
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
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleConfirmDelete()}>Delete & Reassign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ConfigurationTab({
  userId,
  categories, linkedAccounts, expenses,
  categoryPendingById = {},
  linkedAccountPendingById = {},
  partnerX, partnerY, inviteCode,
  onUpdatePartnerNames,
  onAddCategory, onUpdateCategory, onRemoveCategory, onReassignCategory, onUpdateCategoryColor,
  onAddLinkedAccount, onUpdateLinkedAccount, onRemoveLinkedAccount, onReassignLinkedAccount, onUpdateLinkedAccountColor,
  points, incomes, onSaveRestorePoint, onRemoveRestorePoint, onUpdateRestorePointNotes, onRestore,
}: ConfigurationTabProps) {
  return (
    <div className="space-y-6">
      <PartnerNamesCard partnerX={partnerX} partnerY={partnerY} onSave={onUpdatePartnerNames} />
      <InviteCard inviteCode={inviteCode} />
      <ManagedListSection
        title="Categories"
        description="Organize expenses into categories."
        userId={userId}
        items={categories}
        pendingById={categoryPendingById}
        reassignDeletesTarget
        getUsageCount={(id) => expenses.filter(e => e.category_id === id).length}
        onAdd={onAddCategory}
        onUpdate={onUpdateCategory}
        onRemove={onRemoveCategory}
        onReassign={onReassignCategory}
        onUpdateColor={onUpdateCategoryColor}
      />
      <PaymentMethodsSection
        userId={userId}
        linkedAccounts={linkedAccounts}
        expenses={expenses}
        partnerX={partnerX}
        partnerY={partnerY}
        onAdd={onAddLinkedAccount}
        onUpdate={onUpdateLinkedAccount}
        onRemove={onRemoveLinkedAccount}
        onReassign={onReassignLinkedAccount}
        onUpdateColor={onUpdateLinkedAccountColor}
        pendingById={linkedAccountPendingById}
      />
      <RestoreTab
        userId={userId}
        points={points}
        incomes={incomes}
        expenses={expenses}
        categories={categories}
        linkedAccounts={linkedAccounts}
        onSave={onSaveRestorePoint}
        onRemove={onRemoveRestorePoint}
        onUpdateNotes={onUpdateRestorePointNotes}
        onRestore={onRestore}
      />
    </div>
  );
}
