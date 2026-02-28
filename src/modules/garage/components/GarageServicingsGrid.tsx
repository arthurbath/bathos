import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataGrid, GridEditableCell, gridMenuTriggerProps, useDataGrid } from '@/components/ui/data-grid';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, Plus, FileText, Trash2, Pencil } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { GARAGE_SERVICINGS_GRID_DEFAULT_WIDTHS, GRID_FIXED_COLUMNS } from '@/lib/gridColumnWidths';
import type {
  GarageService,
  GarageServiceStatus,
  GarageServicingWithRelations,
} from '@/modules/garage/types/garage';

const columnHelper = createColumnHelper<GarageServicingWithRelations>();
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';
const SERVICING_ACTIONS_NAV_COL = 6;

type OutcomeDraftValue = GarageServiceStatus | 'none';

interface ServicingFormState {
  id: string | null;
  service_date: string;
  odometer_miles: string;
  shop_name: string;
  notes: string;
  outcomes: Record<string, OutcomeDraftValue>;
  newFiles: File[];
}

function buildDefaultOutcomeMap(services: GarageService[], servicing?: GarageServicingWithRelations | null): Record<string, OutcomeDraftValue> {
  const map: Record<string, OutcomeDraftValue> = {};
  for (const service of services) {
    const matched = servicing?.outcomes.find((outcome) => outcome.service_id === service.id);
    map[service.id] = matched?.status ?? 'none';
  }
  return map;
}

function normalizeMileage(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function ServicingActionsCell({
  servicing,
  onEdit,
  onDelete,
}: {
  servicing: GarageServicingWithRelations;
  onEdit: (servicing: GarageServicingWithRelations) => void;
  onDelete: (servicingId: string) => void;
}) {
  const ctx = useDataGrid();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`float-right mr-[5px] h-7 w-7 ${GRID_CONTROL_FOCUS_CLASS}`}
            aria-label={`Actions for ${servicing.service_date}`}
            {...gridMenuTriggerProps(ctx, SERVICING_ACTIONS_NAV_COL)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          <DropdownMenuItem onClick={() => onEdit(servicing)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent className="rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete servicing</AlertDialogTitle>
          <AlertDialogDescription>
            Delete this servicing record from {servicing.service_date}? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onDelete(servicing.id)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface GarageServicingsGridProps {
  userId: string;
  services: GarageService[];
  servicings: GarageServicingWithRelations[];
  loading: boolean;
  vehicleName: string;
  fullView?: boolean;
  onAddServicing: (input: {
    service_date: string;
    odometer_miles: number;
    shop_name?: string | null;
    notes?: string | null;
    outcomes: Array<{ service_id: string; status: GarageServiceStatus }>;
    receipt_files?: File[];
  }) => Promise<void>;
  onUpdateServicing: (id: string, input: {
    service_date: string;
    odometer_miles: number;
    shop_name?: string | null;
    notes?: string | null;
    outcomes: Array<{ service_id: string; status: GarageServiceStatus }>;
    receipt_files?: File[];
  }) => Promise<void>;
  onDeleteServicing: (id: string) => Promise<void>;
  onOpenReceipt: (storagePath: string) => Promise<void>;
  onDeleteReceipt: (receiptId: string, storagePath: string) => Promise<void>;
}

export function GarageServicingsGrid({
  userId,
  services,
  servicings,
  loading,
  vehicleName,
  fullView = false,
  onAddServicing,
  onUpdateServicing,
  onDeleteServicing,
  onOpenReceipt,
  onDeleteReceipt,
}: GarageServicingsGridProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'service_date', desc: true }]);
  const {
    columnSizing,
    columnSizingInfo,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'garage_servicings',
    defaults: GARAGE_SERVICINGS_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.garage_servicings,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [formState, setFormState] = useState<ServicingFormState>({
    id: null,
    service_date: new Date().toISOString().slice(0, 10),
    odometer_miles: '',
    shop_name: '',
    notes: '',
    outcomes: buildDefaultOutcomeMap(services),
    newFiles: [],
  });

  const [editingServicing, setEditingServicing] = useState<GarageServicingWithRelations | null>(null);

  const resetForm = () => {
    setEditingServicing(null);
    setFormState({
      id: null,
      service_date: new Date().toISOString().slice(0, 10),
      odometer_miles: '',
      shop_name: '',
      notes: '',
      outcomes: buildDefaultOutcomeMap(services),
      newFiles: [],
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (servicing: GarageServicingWithRelations) => {
    setEditingServicing(servicing);
    setFormState({
      id: servicing.id,
      service_date: servicing.service_date,
      odometer_miles: String(servicing.odometer_miles),
      shop_name: servicing.shop_name ?? '',
      notes: servicing.notes ?? '',
      outcomes: buildDefaultOutcomeMap(services, servicing),
      newFiles: [],
    });
    setDialogOpen(true);
  };

  const buildOutcomePayload = () =>
    Object.entries(formState.outcomes)
      .filter(([, status]) => status !== 'none')
      .map(([serviceId, status]) => ({
        service_id: serviceId,
        status: status as GarageServiceStatus,
      }));

  const submit = async () => {
    if (!formState.service_date) {
      toast({ title: 'Service date required', variant: 'destructive' });
      return;
    }

    setDialogBusy(true);
    try {
      const payload = {
        service_date: formState.service_date,
        odometer_miles: normalizeMileage(formState.odometer_miles),
        shop_name: formState.shop_name.trim() || null,
        notes: formState.notes.trim() || null,
        outcomes: buildOutcomePayload(),
        receipt_files: formState.newFiles,
      };

      if (formState.id) {
        await onUpdateServicing(formState.id, payload);
      } else {
        await onAddServicing(payload);
      }

      setDialogOpen(false);
      resetForm();
      toast({ title: formState.id ? 'Servicing updated' : 'Servicing added' });
    } catch (error) {
      toast({
        title: 'Failed to save servicing',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDialogBusy(false);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('service_date', {
        header: 'Date',
        size: 120,
        minSize: 105,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.service_date}
            type="date"
            navCol={0}
            onChange={(value) => {
              void onUpdateServicing(row.original.id, {
                service_date: value,
                odometer_miles: row.original.odometer_miles,
                shop_name: row.original.shop_name,
                notes: row.original.notes,
                outcomes: row.original.outcomes.map((outcome) => ({ service_id: outcome.service_id, status: outcome.status })),
                receipt_files: [],
              });
            }}
          />
        ),
      }),
      columnHelper.accessor('odometer_miles', {
        header: 'Mileage',
        size: 110,
        minSize: 90,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.odometer_miles}
            type="number"
            navCol={1}
            onChange={(value) => {
              void onUpdateServicing(row.original.id, {
                service_date: row.original.service_date,
                odometer_miles: normalizeMileage(value),
                shop_name: row.original.shop_name,
                notes: row.original.notes,
                outcomes: row.original.outcomes.map((outcome) => ({ service_id: outcome.service_id, status: outcome.status })),
                receipt_files: [],
              });
            }}
          />
        ),
      }),
      columnHelper.accessor('shop_name', {
        header: 'Shop',
        size: 170,
        minSize: 120,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.shop_name ?? ''}
            navCol={2}
            onChange={(value) => {
              void onUpdateServicing(row.original.id, {
                service_date: row.original.service_date,
                odometer_miles: row.original.odometer_miles,
                shop_name: value.trim() || null,
                notes: row.original.notes,
                outcomes: row.original.outcomes.map((outcome) => ({ service_id: outcome.service_id, status: outcome.status })),
                receipt_files: [],
              });
            }}
          />
        ),
      }),
      columnHelper.display({
        id: 'outcomes',
        header: 'Outcomes',
        size: 140,
        minSize: 120,
        cell: ({ row }) => {
          const performed = row.original.outcomes.filter((outcome) => outcome.status === 'performed').length;
          const notNeeded = row.original.outcomes.filter((outcome) => outcome.status === 'not_needed_yet').length;
          const declined = row.original.outcomes.filter((outcome) => outcome.status === 'declined').length;
          return (
            <span className="text-xs text-foreground">
              P:{performed} N:{notNeeded} D:{declined}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'receipts',
        header: 'Receipts',
        size: 90,
        minSize: 75,
        cell: ({ row }) => (
          <span className="text-xs text-foreground">{row.original.receipts.length}</span>
        ),
      }),
      columnHelper.accessor('notes', {
        header: 'Notes',
        size: 220,
        minSize: 130,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.notes ?? ''}
            navCol={5}
            onChange={(value) => {
              void onUpdateServicing(row.original.id, {
                service_date: row.original.service_date,
                odometer_miles: row.original.odometer_miles,
                shop_name: row.original.shop_name,
                notes: value.trim() || null,
                outcomes: row.original.outcomes.map((outcome) => ({ service_id: outcome.service_id, status: outcome.status })),
                receipt_files: [],
              });
            }}
          />
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        enableResizing: false,
        size: 40,
        minSize: 40,
        maxSize: 40,
        meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
        cell: ({ row }) => (
          <ServicingActionsCell
            servicing={row.original}
            onEdit={openEditDialog}
            onDelete={(servicingId) => {
              void onDeleteServicing(servicingId);
            }}
          />
        ),
      }),
    ],
    [onDeleteServicing, onUpdateServicing, openEditDialog],
  );

  const table = useReactTable({
    data: servicings,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnSizing, columnSizingInfo },
    onSortingChange: setSorting,
    onColumnSizingChange,
    onColumnSizingInfoChange,
    enableSortingRemoval: false,
    columnResizeMode: 'onChange',
  });

  const gridCardContentClassName = fullView ? 'px-0 pb-0 flex-1 min-h-0' : 'space-y-3 px-0';

  return (
    <Card className={`max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0 ${fullView ? 'h-full min-h-0 flex flex-col border-t-0 md:border-t' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Servicings</CardTitle>
        <Button
          type="button"
          variant="outline-success"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Add servicing"
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className={gridCardContentClassName}>
        <DataGrid
          table={table}
          fullView={fullView}
          maxHeight={fullView ? 'none' : undefined}
          className={fullView ? 'h-full min-h-0' : undefined}
          emptyMessage={loading ? 'Loading servicings…' : 'No servicings yet.'}
        />
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => !dialogBusy && setDialogOpen(open)}>
        <DialogContent className="max-w-3xl rounded-lg">
          <DialogHeader>
            <DialogTitle>{formState.id ? 'Edit Servicing' : 'Add Servicing'}</DialogTitle>
            <DialogDescription>Record services performed or marked not needed for this visit.</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="garage-servicing-date">Date</Label>
                <Input id="garage-servicing-date" type="date" value={formState.service_date} onChange={(event) => setFormState((prev) => ({ ...prev, service_date: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-servicing-mileage">Mileage</Label>
                <Input id="garage-servicing-mileage" type="number" value={formState.odometer_miles} onChange={(event) => setFormState((prev) => ({ ...prev, odometer_miles: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-servicing-shop">Shop</Label>
                <Input id="garage-servicing-shop" value={formState.shop_name} onChange={(event) => setFormState((prev) => ({ ...prev, shop_name: event.target.value }))} placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="garage-servicing-notes">Notes</Label>
              <Input id="garage-servicing-notes" value={formState.notes} onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Optional" />
            </div>

            <div className="space-y-2">
              <Label>Service Outcomes</Label>
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <div className="divide-y">
                  {services.map((service) => (
                    <div key={service.id} className="grid items-center gap-3 px-3 py-2 sm:grid-cols-[1fr_180px]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{service.name}</p>
                        <p className="text-xs text-muted-foreground">{service.type}</p>
                      </div>
                      <Select
                        value={formState.outcomes[service.id] ?? 'none'}
                        onValueChange={(value) => {
                          setFormState((prev) => ({
                            ...prev,
                            outcomes: {
                              ...prev.outcomes,
                              [service.id]: value as OutcomeDraftValue,
                            },
                          }));
                        }}
                      >
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not logged</SelectItem>
                          <SelectItem value="performed">Performed</SelectItem>
                          <SelectItem value="not_needed_yet">Not Needed Yet</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="garage-servicing-receipts">Add Receipts</Label>
              <Input
                id="garage-servicing-receipts"
                type="file"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  setFormState((prev) => ({ ...prev, newFiles: files }));
                }}
              />
              {formState.newFiles.length > 0 && (
                <p className="text-xs text-muted-foreground">{formState.newFiles.length} file(s) ready to upload</p>
              )}
            </div>

            {editingServicing && editingServicing.receipts.length > 0 && (
              <div className="space-y-2">
                <Label>Existing Receipts</Label>
                <div className="space-y-2">
                  {editingServicing.receipts.map((receipt) => (
                    <div key={receipt.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-sm underline decoration-dashed underline-offset-2"
                        onClick={() => {
                          void onOpenReceipt(receipt.storage_object_path);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                        <span>{receipt.filename}</span>
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline-destructive"
                        onClick={() => {
                          void onDeleteReceipt(receipt.id, receipt.storage_object_path);
                          setEditingServicing((prev) => prev
                            ? {
                                ...prev,
                                receipts: prev.receipts.filter((row) => row.id !== receipt.id),
                              }
                            : prev);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={dialogBusy}>Cancel</Button>
            <Button type="button" onClick={() => { void submit(); }} disabled={dialogBusy}>{dialogBusy ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
