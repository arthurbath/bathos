import { useMemo, useState } from 'react';
import { Check, Copy, LayoutGrid, MoreHorizontal, Plus, Settings, Users } from 'lucide-react';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';
import { useDrawersUnits } from '@/modules/drawers/hooks/useDrawersUnits';
import { useDrawerInsertInstances } from '@/modules/drawers/hooks/useDrawerInsertInstances';
import type { DrawerInsertInstance, DrawerInsertType, DrawersHouseholdData, DrawersUnit, DrawersUnitFrameColor } from '@/modules/drawers/types/drawers';
import { useLocation, useNavigate } from 'react-router-dom';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';

interface DrawersPlannerProps {
  household: DrawersHouseholdData;
  userId: string;
  onSignOut: () => Promise<void> | void;
}

type DeleteMode = 'move' | 'delete';
type AddInsertTarget = { unitId: string; cubbyX: number; cubbyY: number } | null;

function limboInsertVisualClass(insertType: DrawerInsertType): string {
  if (insertType === 'black') return 'bg-primary text-primary-foreground border-primary';
  if (insertType === 'wicker') return 'bg-[hsl(var(--drawer-wicker))] text-[hsl(var(--drawer-wicker-foreground))] border-[hsl(var(--drawer-wicker))]';
  return 'bg-white text-black border-border';
}

function unitCellVisualClass(_frameColor: DrawersUnitFrameColor | null | undefined, insertType: DrawerInsertType | null): string {
  const grayFillClass = 'bg-[hsl(var(--grid-sticky-line))]';
  const grayBorderClass = 'border-[hsl(var(--muted-foreground))]';

  // Empty cubby slots are always solid gray with gray borders.
  if (!insertType) {
    return `${grayFillClass} text-foreground ${grayBorderClass}`;
  }

  if (insertType === 'blank') {
    return `bg-white text-black ${grayBorderClass}`;
  }

  if (insertType === 'black') {
    return `bg-primary text-primary-foreground ${grayBorderClass}`;
  }

  // insertType === 'wicker' (displayed as Brown in UI)
  return `bg-[hsl(var(--drawer-wicker))] text-[hsl(var(--drawer-wicker-foreground))] ${grayBorderClass}`;
}

function unitFrameClass(frameColor: DrawersUnitFrameColor | null | undefined): string {
  if (frameColor === 'black') return 'bg-primary border-[hsl(var(--muted-foreground))]';
  if (frameColor === 'brown') return 'bg-[hsl(var(--drawer-wicker))] border-[hsl(var(--muted-foreground))]';
  return 'bg-white border-[hsl(var(--muted-foreground))]';
}

function cubbyKey(unitId: string, x: number, y: number): string {
  return `${unitId}:${x}:${y}`;
}

function getCubbySizePx(cubbiesWide: number): number {
  const clampedWidth = Math.min(6, Math.max(1, cubbiesWide));
  return clampedWidth >= 5 ? 62 : 68;
}

function getDesktopUnitCardWidth(cubbiesWide: number): string {
  const clampedWidth = Math.min(6, Math.max(1, cubbiesWide));
  const cubbySizePx = getCubbySizePx(clampedWidth);
  const cubbyGapPx = 4;
  const cardHorizontalPaddingPx = 48;
  const safetyBufferPx = 2;
  return `${clampedWidth * cubbySizePx + (clampedWidth - 1) * cubbyGapPx + cardHorizontalPaddingPx + safetyBufferPx}px`;
}

function getDesktopUnitGridWidth(cubbiesWide: number): string {
  const clampedWidth = Math.min(6, Math.max(1, cubbiesWide));
  const cubbySizePx = getCubbySizePx(clampedWidth);
  const cubbyGapPx = 4;
  return `${clampedWidth * cubbySizePx + (clampedWidth - 1) * cubbyGapPx}px`;
}

export function DrawersPlanner({ household, userId, onSignOut }: DrawersPlannerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = useModuleBasePath();
  const isPlannerRoute = location.pathname.endsWith('/plan');
  const isConfigRoute = location.pathname.endsWith('/config');

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }
    return fallback;
  };

  const {
    units,
    loading: unitsLoading,
    add: addUnit,
    rename: renameUnit,
    resize: resizeUnit,
    setFrameColor: setUnitFrameColor,
    reorder,
    remove: removeUnit,
  } = useDrawersUnits(
    household.householdId,
  );
  const {
    inserts,
    limboInserts,
    loading: insertsLoading,
    add: addInsert,
    update: updateInsert,
    remove: removeInsert,
    moveToCubby,
    moveToLimbo,
    deleteInsertsInUnit,
    moveInsertsInUnitToLimbo,
  } = useDrawerInsertInstances(household.householdId);

  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [unitDialogBusy, setUnitDialogBusy] = useState(false);
  const [unitDialogUnitId, setUnitDialogUnitId] = useState<string | null>(null);
  const [unitNameDraft, setUnitNameDraft] = useState('');
  const [unitWidthDraft, setUnitWidthDraft] = useState('2');
  const [unitHeightDraft, setUnitHeightDraft] = useState('2');
  const [unitFrameColorDraft, setUnitFrameColorDraft] = useState<DrawersUnitFrameColor>('white');

  const [addInsertDialogOpen, setAddInsertDialogOpen] = useState(false);
  const [addInsertBusy, setAddInsertBusy] = useState(false);
  const [addInsertTarget, setAddInsertTarget] = useState<AddInsertTarget>(null);
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const [newInsertType, setNewInsertType] = useState<DrawerInsertType>('black');
  const [newInsertLabel, setNewInsertLabel] = useState('');

  const [heldInsertId, setHeldInsertId] = useState<string | null>(null);
  const [editInsertDialogOpen, setEditInsertDialogOpen] = useState(false);
  const [editInsertBusy, setEditInsertBusy] = useState(false);
  const [editInsertId, setEditInsertId] = useState<string | null>(null);
  const [editInsertType, setEditInsertType] = useState<DrawerInsertType>('black');
  const [editInsertLabel, setEditInsertLabel] = useState('');

  const [unitPendingDelete, setUnitPendingDelete] = useState<DrawersUnit | null>(null);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('move');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const insertsById = useMemo(() => {
    const map = new Map<string, DrawerInsertInstance>();
    inserts.forEach(insert => map.set(insert.id, insert));
    return map;
  }, [inserts]);

  const cubbyMap = useMemo(() => {
    const map = new Map<string, DrawerInsertInstance>();
    inserts.forEach(insert => {
      if (insert.location_kind === 'cubby' && insert.unit_id && insert.cubby_x && insert.cubby_y) {
        map.set(cubbyKey(insert.unit_id, insert.cubby_x, insert.cubby_y), insert);
      }
    });
    return map;
  }, [inserts]);

  const heldInsert = heldInsertId ? insertsById.get(heldInsertId) ?? null : null;
  const addTargetUnit = addInsertTarget ? units.find(unit => unit.id === addInsertTarget.unitId) ?? null : null;

  const normalizeDimension = (value: number) => {
    if (Number.isNaN(value)) return 1;
    return Math.min(6, Math.max(1, Math.trunc(value)));
  };

  const parseDimensionDraft = (value: string) => {
    if (!value.trim()) return 1;
    return normalizeDimension(Number(value));
  };

  const resetUnitDialog = () => {
    setUnitDialogBusy(false);
    setUnitDialogOpen(false);
    setUnitDialogUnitId(null);
    setUnitNameDraft('');
    setUnitWidthDraft('2');
    setUnitHeightDraft('2');
    setUnitFrameColorDraft('white');
  };

  const openCreateUnitDialog = () => {
    setUnitDialogUnitId(null);
    setUnitNameDraft(`Unit ${units.length + 1}`);
    setUnitWidthDraft('2');
    setUnitHeightDraft('2');
    setUnitFrameColorDraft('white');
    setUnitDialogOpen(true);
  };

  const openEditUnitDialog = (unit: DrawersUnit) => {
    setUnitDialogUnitId(unit.id);
    setUnitNameDraft(unit.name);
    setUnitWidthDraft(String(unit.width));
    setUnitHeightDraft(String(unit.height));
    setUnitFrameColorDraft(unit.frame_color ?? 'white');
    setUnitDialogOpen(true);
  };

  const handleSaveUnit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (unitDialogBusy) return;

    const normalizedName = unitNameDraft.trim() || 'Untitled unit';
    const normalizedWidth = parseDimensionDraft(unitWidthDraft);
    const normalizedHeight = parseDimensionDraft(unitHeightDraft);
    const normalizedFrameColor = unitFrameColorDraft;

    setUnitDialogBusy(true);
    try {
      if (!unitDialogUnitId) {
        await addUnit({
          name: normalizedName,
          width: normalizedWidth,
          height: normalizedHeight,
          frame_color: normalizedFrameColor,
        });
        resetUnitDialog();
        return;
      }

      const existing = units.find(unit => unit.id === unitDialogUnitId);
      if (!existing) {
        throw new Error('Unit no longer exists.');
      }

      if (existing.name !== normalizedName) {
        await renameUnit(existing.id, normalizedName);
      }

      if (existing.width !== normalizedWidth || existing.height !== normalizedHeight) {
        await resizeUnit(existing.id, normalizedWidth, normalizedHeight);
      }

      if ((existing.frame_color ?? 'white') !== normalizedFrameColor) {
        await setUnitFrameColor(existing.id, normalizedFrameColor);
      }

      resetUnitDialog();
    } catch (error: unknown) {
      setUnitDialogBusy(false);
      const errorMessage = getErrorMessage(error, 'Please try again.');
      const colorMigrationMissing =
        errorMessage.includes('frame_color') &&
        errorMessage.toLowerCase().includes('does not exist');
      toast({
        title: 'Failed to save unit',
        description: colorMigrationMissing
          ? 'Unit color requires the latest Drawer Planner migration. Apply migrations, then try again.'
          : errorMessage,
        variant: 'destructive',
      });
    }
  };

  const resetAddInsertDialog = () => {
    setAddInsertBusy(false);
    setAddInsertDialogOpen(false);
    setAddInsertTarget(null);
    setNewInsertType('black');
    setNewInsertLabel('');
  };

  const resetEditInsertDialog = () => {
    setEditInsertBusy(false);
    setEditInsertDialogOpen(false);
    setEditInsertId(null);
    setEditInsertType('black');
    setEditInsertLabel('');
  };

  const openEditInsertDialog = (insert: DrawerInsertInstance) => {
    setEditInsertId(insert.id);
    setEditInsertType(insert.insert_type);
    setEditInsertLabel(insert.label ?? '');
    setEditInsertDialogOpen(true);
  };

  const handleSaveEditInsert = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editInsertId || editInsertBusy) return;

    setEditInsertBusy(true);
    try {
      await updateInsert(editInsertId, {
        insert_type: editInsertType,
        label: editInsertLabel,
      });
      resetEditInsertDialog();
    } catch (error: unknown) {
      setEditInsertBusy(false);
      toast({
        title: 'Failed to Update Insert',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const openAddInsertDialog = (target: AddInsertTarget) => {
    setAddInsertTarget(target);
    setAddInsertDialogOpen(true);
  };

  const handleAddInsert = async (event: React.FormEvent) => {
    event.preventDefault();

    if (addInsertBusy) return;

    if (addInsertTarget) {
      const occupied = cubbyMap.get(cubbyKey(addInsertTarget.unitId, addInsertTarget.cubbyX, addInsertTarget.cubbyY));
      if (occupied) {
        toast({
          title: 'Cubby is no longer empty',
          description: 'Choose another cubby and try again.',
          variant: 'destructive',
        });
        return;
      }
    }

    setAddInsertBusy(true);
    try {
      await addInsert(newInsertType, newInsertLabel || null, addInsertTarget ?? undefined);
      setHeldInsertId(null);
      resetAddInsertDialog();
    } catch (error: unknown) {
      setAddInsertBusy(false);
      toast({
        title: 'Failed to add insert',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const handleCellClick = async (unitId: string, x: number, y: number) => {
    const occupant = cubbyMap.get(cubbyKey(unitId, x, y)) ?? null;

    if (!heldInsert) {
      if (!occupant) {
        openAddInsertDialog({ unitId, cubbyX: x, cubbyY: y });
        return;
      }
      return;
    }

    if (heldInsert.location_kind === 'cubby' && heldInsert.unit_id === unitId && heldInsert.cubby_x === x && heldInsert.cubby_y === y) {
      setHeldInsertId(null);
      return;
    }

    try {
      await moveToCubby(heldInsert.id, unitId, x, y, occupant?.id);
      setHeldInsertId(null);
    } catch (error: unknown) {
      toast({
        title: 'Move failed',
        description: getErrorMessage(error, 'Unable to place insert.'),
        variant: 'destructive',
      });
    }
  };

  const handleDropHeldToLimbo = async () => {
    if (!heldInsert) return;
    try {
      if (heldInsert.location_kind === 'cubby') {
        await moveToLimbo(heldInsert.id);
      }
      setHeldInsertId(null);
    } catch (error: unknown) {
      toast({
        title: 'Move failed',
        description: getErrorMessage(error, 'Unable to move insert to limbo.'),
        variant: 'destructive',
      });
    }
  };

  const handleSendInsertToLimbo = async (insertId: string) => {
    try {
      await moveToLimbo(insertId);
      if (heldInsertId === insertId) setHeldInsertId(null);
    } catch (error: unknown) {
      toast({
        title: 'Move Failed',
        description: getErrorMessage(error, 'Unable to move insert to limbo.'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteInsert = async (insertId: string) => {
    try {
      await removeInsert(insertId);
      if (heldInsertId === insertId) setHeldInsertId(null);
    } catch (error: unknown) {
      toast({
        title: 'Failed to Delete Insert',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUnit = async () => {
    if (!unitPendingDelete) return;

    setDeleteBusy(true);
    try {
      if (deleteMode === 'move') {
        await moveInsertsInUnitToLimbo(unitPendingDelete.id);
      } else {
        await deleteInsertsInUnit(unitPendingDelete.id);
      }

      await removeUnit(unitPendingDelete.id);
      setUnitPendingDelete(null);
    } catch (error: unknown) {
      toast({
        title: 'Failed to delete unit',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!household.inviteCode) return;

    await navigator.clipboard.writeText(household.inviteCode);
    setInviteCodeCopied(true);
    toast({ title: 'Invite code copied' });
    window.setTimeout(() => setInviteCodeCopied(false), 2000);
  };

  if (unitsLoading || insertsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ToplineHeader title="Drawer Planner" userId={userId} displayName={household.displayName} onSignOut={onSignOut} showAppSwitcher />

      <div className="mx-auto max-w-5xl px-4 pt-6">
        <nav className="grid w-full grid-cols-2 gap-0.5 rounded-lg border border-[hsl(var(--grid-sticky-line))] bg-border p-1 text-muted-foreground">
          {([
            { path: '/plan', icon: LayoutGrid, label: 'Planner' },
            { path: '/config', icon: Settings, label: 'Config' },
          ] as const).map(({ path, icon: Icon, label }) => {
            const fullPath = `${basePath}${path}`;
            const active = location.pathname === fullPath || (!basePath && location.pathname === path);
            return (
              <button
                key={path}
                onClick={() => navigate(fullPath)}
                className={`inline-flex items-center justify-center gap-0 sm:gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${active ? 'bg-background text-foreground shadow-sm' : 'hover:bg-background/50'}`}
              >
                <Icon className="hidden h-4 w-4 sm:inline" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {isPlannerRoute && (
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-6">
        <div className="mb-4 space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold leading-none tracking-tight">Units</h2>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openCreateUnitDialog}>
                <Plus className="h-4 w-4" />
                Add Unit
              </Button>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-stretch">
              {units.map((unit, idx) => (
                <Card
                  key={unit.id}
                  className="flex w-full flex-col sm:basis-[var(--unit-card-width)] sm:min-w-[var(--unit-card-width)] sm:grow sm:self-stretch"
                  style={{
                    ['--unit-card-width' as string]: getDesktopUnitCardWidth(unit.width),
                    ['--unit-grid-width' as string]: getDesktopUnitGridWidth(unit.width),
                  }}
                >
                  <CardHeader className="mb-2 pb-2">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle>{unit.name}</CardTitle>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" title="Unit Actions" className="-mt-0.5 -mr-0.5 h-7 w-7 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => openEditUnitDialog(unit)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={idx === 0}
                              onClick={() => void reorder(unit.id, 'up')}
                            >
                              Move Up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={idx === units.length - 1}
                              onClick={() => void reorder(unit.id, 'down')}
                            >
                              Move Down
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteMode('move');
                                setUnitPendingDelete(unit);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-1">
                    <div className="my-auto flex w-full justify-center overflow-x-auto">
                      <div
                        className={`w-[var(--unit-grid-width)] rounded-md border p-2 ${unitFrameClass(unit.frame_color)}`}
                      >
                        <div
                          className="grid w-full gap-1"
                          style={{ gridTemplateColumns: `repeat(${unit.width}, minmax(0, 1fr))` }}
                        >
                          {Array.from({ length: unit.height }).map((_, rowIdx) => {
                            const y = rowIdx + 1;
                            return Array.from({ length: unit.width }).map((__, colIdx) => {
                              const x = colIdx + 1;
                              const occupant = cubbyMap.get(cubbyKey(unit.id, x, y)) ?? null;
                              const isHeldOccupant = heldInsertId === occupant?.id;
                              const cellClassName = `aspect-square overflow-hidden rounded-sm border text-[11px] text-center transition ${unitCellVisualClass(unit.frame_color, occupant?.insert_type ?? null)} ${isHeldOccupant ? 'border-[3px] border-warning' : ''}`;

                              if (occupant && !heldInsert) {
                                return (
                                  <DropdownMenu key={`${unit.id}:${x}:${y}`}>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className={cellClassName}
                                      >
                                        <span className="block w-full overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] break-normal leading-tight">
                                          {occupant.label?.trim() || ''}
                                        </span>
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="bg-popover">
                                      <DropdownMenuItem onClick={() => openEditInsertDialog(occupant)}>
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setHeldInsertId(occupant.id)}>
                                        Move
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => void handleSendInsertToLimbo(occupant.id)}>
                                        Send to Limbo
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => void handleDeleteInsert(occupant.id)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  key={`${unit.id}:${x}:${y}`}
                                  onClick={() => void handleCellClick(unit.id, x, y)}
                                  className={cellClassName}
                                >
                                  <span className="block w-full overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] break-normal leading-tight">
                                    {occupant?.label?.trim() || ''}
                                  </span>
                                </button>
                              );
                            });
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {units.length === 0 && (
                <Card className="w-full bg-muted/30">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Click "Add Unit" to create your first unit.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <Card className="w-full bg-muted/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Limbo</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openAddInsertDialog(null)}>
                    + Add Insert
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {limboInserts.map(insert => {
                  const held = heldInsertId === insert.id;
                  const limboTileClass = `min-h-16 w-28 flex-none rounded-md border text-left text-xs transition ${limboInsertVisualClass(insert.insert_type)} ${held ? 'border-[3px] border-warning' : ''}`;

                  return (
                    <DropdownMenu key={insert.id}>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className={limboTileClass}>
                          <p className="overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] break-normal font-medium leading-tight">
                            {insert.label?.trim() || ''}
                          </p>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="bg-popover">
                        <DropdownMenuItem onClick={() => openEditInsertDialog(insert)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHeldInsertId(insert.id)}>
                          Move
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handleDeleteInsert(insert.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}

                {limboInserts.length === 0 && (
                  <p className="text-xs text-muted-foreground">No inserts in limbo.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      )}

      {isConfigRoute && (
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Invite Collaborators</CardTitle>
            </div>
            <CardDescription>Share this code so another user can join this drawer household.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                readOnly
                value={household.inviteCode ?? 'Generating...'}
                className="font-mono text-lg tracking-widest text-center"
              />
              <Button variant="outline" size="icon" onClick={() => void handleCopyInviteCode()} disabled={!household.inviteCode}>
                {inviteCodeCopied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      )}

      <AlertDialog
        open={!!unitPendingDelete}
        onOpenChange={open => {
          if (!open) {
            setUnitPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit</AlertDialogTitle>
            <AlertDialogDescription>
              Choose what to do with inserts currently in {unitPendingDelete?.name || 'this unit'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogBody className="space-y-2">
            <Button
              type="button"
              variant={deleteMode === 'move' ? 'default' : 'outline'}
              className="w-full"
              onClick={() => setDeleteMode('move')}
            >
              Move Inserts to Limbo
            </Button>
            <Button
              type="button"
              variant={deleteMode === 'delete' ? 'destructive' : 'outline'}
              className="w-full"
              onClick={() => setDeleteMode('delete')}
            >
              Delete Inserts
            </Button>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUnit}
              disabled={deleteBusy}
              className={deleteMode === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {deleteBusy ? 'Deleting...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={unitDialogOpen}
        onOpenChange={open => {
          if (!open) resetUnitDialog();
        }}
      >
          <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{unitDialogUnitId ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form id="unit-form" onSubmit={handleSaveUnit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="unitName">Name</Label>
                <Input
                  id="unitName"
                  value={unitNameDraft}
                  onChange={event => setUnitNameDraft(event.target.value)}
                  placeholder="Office West"
                  className="h-10 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unitFrameColor">Color</Label>
                <Select value={unitFrameColorDraft} onValueChange={value => setUnitFrameColorDraft(value as DrawersUnitFrameColor)}>
                  <SelectTrigger id="unitFrameColor" className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="black">Black</SelectItem>
                    <SelectItem value="brown">Brown</SelectItem>
                    <SelectItem value="white">White</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="unitWidth">Width</Label>
                  <Input
                    id="unitWidth"
                    type="number"
                    min={1}
                    max={6}
                    value={unitWidthDraft}
                    onChange={event => setUnitWidthDraft(event.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unitHeight">Height</Label>
                  <Input
                    id="unitHeight"
                    type="number"
                    min={1}
                    max={6}
                    value={unitHeightDraft}
                    onChange={event => setUnitHeightDraft(event.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={resetUnitDialog} disabled={unitDialogBusy}>
              Cancel
            </Button>
            <Button type="submit" form="unit-form" disabled={unitDialogBusy}>
              {unitDialogBusy ? 'Saving...' : 'Save Unit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addInsertDialogOpen}
        onOpenChange={open => {
          if (!open) resetAddInsertDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{addInsertTarget ? 'Add Insert to Cubby' : 'Add Insert to Limbo'}</DialogTitle>
            {addInsertTarget && (
              <DialogDescription>
                {`Create a new insert for ${addTargetUnit?.name || 'selected unit'} cubby (${addInsertTarget.cubbyX}, ${addInsertTarget.cubbyY}).`}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogBody>
            <form id="add-insert-form" onSubmit={handleAddInsert} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="modalInsertLabel">Label</Label>
                <Input
                  id="modalInsertLabel"
                  value={newInsertLabel}
                  onChange={event => setNewInsertLabel(event.target.value)}
                  placeholder="Books"
                  className="h-10 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                  <Label htmlFor="modalInsertType">Insert Type</Label>
                <Select value={newInsertType} onValueChange={value => setNewInsertType(value as DrawerInsertType)}>
                  <SelectTrigger id="modalInsertType" className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="black">Black</SelectItem>
                    <SelectItem value="wicker">Brown</SelectItem>
                    <SelectItem value="blank">White</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={resetAddInsertDialog} disabled={addInsertBusy}>
              Cancel
            </Button>
            <Button type="submit" form="add-insert-form" disabled={addInsertBusy}>
              {addInsertBusy ? 'Saving...' : 'Save Insert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editInsertDialogOpen}
        onOpenChange={open => {
          if (!open) resetEditInsertDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Insert</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form id="edit-insert-form" onSubmit={handleSaveEditInsert} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="editInsertLabel">Label</Label>
                <Input
                  id="editInsertLabel"
                  value={editInsertLabel}
                  onChange={event => setEditInsertLabel(event.target.value)}
                  placeholder="Books"
                  className="h-10 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editInsertType">Insert Type</Label>
                <Select value={editInsertType} onValueChange={value => setEditInsertType(value as DrawerInsertType)}>
                  <SelectTrigger id="editInsertType" className="h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="black">Black</SelectItem>
                    <SelectItem value="wicker">Brown</SelectItem>
                    <SelectItem value="blank">White</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={resetEditInsertDialog} disabled={editInsertBusy}>
              Cancel
            </Button>
            <Button type="submit" form="edit-insert-form" disabled={editInsertBusy || !editInsertId}>
              {editInsertBusy ? 'Saving...' : 'Save Insert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
