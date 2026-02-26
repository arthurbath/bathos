import { useMemo, useState } from 'react';
import { Check, Copy, LayoutGrid, MoreHorizontal, Plus, Settings } from 'lucide-react';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useDrawerInstances } from '@/modules/drawers/hooks/useDrawerInstances';
import type { DrawerInstance, DrawerType, DrawersHouseholdData, DrawersUnit, DrawersUnitFrameColor } from '@/modules/drawers/types/drawers';
import { useLocation, useNavigate } from 'react-router-dom';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';

interface DrawersPlannerProps {
  household: DrawersHouseholdData;
  userId: string;
  onSignOut: () => Promise<void> | void;
}

type DeleteMode = 'move' | 'delete';
type AddDrawerTarget = { unitId: string; cubbyX: number; cubbyY: number } | null;

function limboDrawerVisualClass(drawerType: DrawerType): string {
  const grayBorderClass = 'border-[hsl(var(--muted-foreground))]';
  if (drawerType === 'black') return `bg-black text-white ${grayBorderClass}`;
  if (drawerType === 'wicker') return `bg-[hsl(var(--drawer-wicker))] text-[hsl(var(--drawer-wicker-foreground))] ${grayBorderClass}`;
  return `bg-white text-black ${grayBorderClass}`;
}

function unitCellVisualClass(_frameColor: DrawersUnitFrameColor | null | undefined, drawerType: DrawerType | null): string {
  const grayFillClass = 'bg-[hsl(var(--grid-sticky-line))]';
  const grayBorderClass = 'border-[hsl(var(--muted-foreground))]';

  // Empty cubby slots are always solid gray with gray borders.
  if (!drawerType) {
    return `${grayFillClass} text-foreground ${grayBorderClass}`;
  }

  if (drawerType === 'blank') {
    return `bg-white text-black ${grayBorderClass}`;
  }

  if (drawerType === 'black') {
    return `bg-black text-white ${grayBorderClass}`;
  }

  // drawerType === 'wicker' (displayed as Brown in UI)
  return `bg-[hsl(var(--drawer-wicker))] text-[hsl(var(--drawer-wicker-foreground))] ${grayBorderClass}`;
}

function unitFrameClass(frameColor: DrawersUnitFrameColor | null | undefined): string {
  if (frameColor === 'black') return 'bg-black border-[hsl(var(--muted-foreground))]';
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
  const drawersNavItems = [
    { path: '/plan', icon: LayoutGrid, label: 'Planner' },
    { path: '/config', icon: Settings, label: 'Config' },
  ] as const;

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
    save: saveUnit,
    reorder,
    remove: removeUnit,
    pendingById: unitPendingById = {},
    creating: creatingUnit = false,
  } = useDrawersUnits(
    household.householdId,
  );
  const {
    drawers,
    limboDrawers,
    loading: drawersLoading,
    add: addDrawer,
    update: updateDrawer,
    remove: removeDrawer,
    moveToCubby,
    moveToLimbo,
    deleteDrawersInUnit,
    moveDrawersInUnitToLimbo,
    pendingById: drawerPendingById = {},
    creating: creatingDrawer = false,
  } = useDrawerInstances(household.householdId);

  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [unitDialogBusy, setUnitDialogBusy] = useState(false);
  const [unitDialogUnitId, setUnitDialogUnitId] = useState<string | null>(null);
  const [unitNameDraft, setUnitNameDraft] = useState('');
  const [unitWidthDraft, setUnitWidthDraft] = useState('2');
  const [unitHeightDraft, setUnitHeightDraft] = useState('2');
  const [unitFrameColorDraft, setUnitFrameColorDraft] = useState<DrawersUnitFrameColor>('white');

  const [addDrawerDialogOpen, setAddDrawerDialogOpen] = useState(false);
  const [addDrawerBusy, setAddDrawerBusy] = useState(false);
  const [addDrawerTarget, setAddDrawerTarget] = useState<AddDrawerTarget>(null);
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const [newDrawerType, setNewDrawerType] = useState<DrawerType>('black');
  const [newDrawerLabel, setNewDrawerLabel] = useState('');

  const [heldDrawerId, setHeldDrawerId] = useState<string | null>(null);
  const [editDrawerDialogOpen, setEditDrawerDialogOpen] = useState(false);
  const [editDrawerBusy, setEditDrawerBusy] = useState(false);
  const [editDrawerId, setEditDrawerId] = useState<string | null>(null);
  const [editDrawerType, setEditDrawerType] = useState<DrawerType>('black');
  const [editDrawerLabel, setEditDrawerLabel] = useState('');

  const [unitPendingDelete, setUnitPendingDelete] = useState<DrawersUnit | null>(null);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('move');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const drawersById = useMemo(() => {
    const map = new Map<string, DrawerInstance>();
    drawers.forEach(drawer => map.set(drawer.id, drawer));
    return map;
  }, [drawers]);

  const cubbyMap = useMemo(() => {
    const map = new Map<string, DrawerInstance>();
    drawers.forEach(drawer => {
      if (drawer.location_kind === 'cubby' && drawer.unit_id && drawer.cubby_x && drawer.cubby_y) {
        map.set(cubbyKey(drawer.unit_id, drawer.cubby_x, drawer.cubby_y), drawer);
      }
    });
    return map;
  }, [drawers]);

  const heldDrawer = heldDrawerId ? drawersById.get(heldDrawerId) ?? null : null;
  const heldDrawerPending = heldDrawer ? !!drawerPendingById[heldDrawer.id] : false;
  const addTargetUnit = addDrawerTarget ? units.find(unit => unit.id === addDrawerTarget.unitId) ?? null : null;
  const pendingUnitDrawerCount = unitPendingDelete
    ? drawers.filter(drawer => drawer.location_kind === 'cubby' && drawer.unit_id === unitPendingDelete.id).length
    : 0;
  const pendingUnitHasDrawers = pendingUnitDrawerCount > 0;

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
      await saveUnit({
        id: unitDialogUnitId ?? null,
        name: normalizedName,
        width: normalizedWidth,
        height: normalizedHeight,
        frame_color: normalizedFrameColor,
      });

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

  const resetAddDrawerDialog = () => {
    setAddDrawerBusy(false);
    setAddDrawerDialogOpen(false);
    setAddDrawerTarget(null);
    setNewDrawerType('black');
    setNewDrawerLabel('');
  };

  const resetEditDrawerDialog = () => {
    setEditDrawerBusy(false);
    setEditDrawerDialogOpen(false);
    setEditDrawerId(null);
    setEditDrawerType('black');
    setEditDrawerLabel('');
  };

  const openEditDrawerDialog = (drawer: DrawerInstance) => {
    setEditDrawerId(drawer.id);
    setEditDrawerType(drawer.drawer_type);
    setEditDrawerLabel(drawer.label ?? '');
    setEditDrawerDialogOpen(true);
  };

  const handleSaveEditDrawer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editDrawerId || editDrawerBusy) return;

    setEditDrawerBusy(true);
    try {
      await updateDrawer(editDrawerId, {
        drawer_type: editDrawerType,
        label: editDrawerLabel,
      });
      resetEditDrawerDialog();
    } catch (error: unknown) {
      setEditDrawerBusy(false);
      toast({
        title: 'Failed to Update Drawer',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const openAddDrawerDialog = (target: AddDrawerTarget) => {
    setAddDrawerTarget(target);
    setAddDrawerDialogOpen(true);
  };

  const handleAddDrawer = async (event: React.FormEvent) => {
    event.preventDefault();

    if (addDrawerBusy) return;

    if (addDrawerTarget) {
      const occupied = cubbyMap.get(cubbyKey(addDrawerTarget.unitId, addDrawerTarget.cubbyX, addDrawerTarget.cubbyY));
      if (occupied) {
        toast({
          title: 'Cubby is no longer empty',
          description: 'Choose another cubby and try again.',
          variant: 'destructive',
        });
        return;
      }
    }

    setAddDrawerBusy(true);
    try {
      await addDrawer(newDrawerType, newDrawerLabel || null, addDrawerTarget ?? undefined);
      setHeldDrawerId(null);
      resetAddDrawerDialog();
    } catch (error: unknown) {
      setAddDrawerBusy(false);
      toast({
        title: 'Failed to add drawer',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const handleCellClick = async (unitId: string, x: number, y: number) => {
    if (heldDrawerPending || unitPendingById[unitId]) return;
    const occupant = cubbyMap.get(cubbyKey(unitId, x, y)) ?? null;
    if (occupant && drawerPendingById[occupant.id]) return;

    if (!heldDrawer) {
      if (!occupant) {
        openAddDrawerDialog({ unitId, cubbyX: x, cubbyY: y });
        return;
      }
      return;
    }

    if (heldDrawer.location_kind === 'cubby' && heldDrawer.unit_id === unitId && heldDrawer.cubby_x === x && heldDrawer.cubby_y === y) {
      setHeldDrawerId(null);
      return;
    }

    try {
      await moveToCubby(heldDrawer.id, unitId, x, y, occupant?.id);
      setHeldDrawerId(null);
    } catch (error: unknown) {
      toast({
        title: 'Move failed',
        description: getErrorMessage(error, 'Unable to place drawer.'),
        variant: 'destructive',
      });
    }
  };

  const handleDropHeldToLimbo = async () => {
    if (!heldDrawer || heldDrawerPending) return;
    try {
      if (heldDrawer.location_kind === 'cubby') {
        await moveToLimbo(heldDrawer.id);
      }
      setHeldDrawerId(null);
    } catch (error: unknown) {
      toast({
        title: 'Move failed',
        description: getErrorMessage(error, 'Unable to move drawer to limbo.'),
        variant: 'destructive',
      });
    }
  };

  const handleSendDrawerToLimbo = async (drawerId: string) => {
    if (drawerPendingById[drawerId]) return;
    try {
      await moveToLimbo(drawerId);
      if (heldDrawerId === drawerId) setHeldDrawerId(null);
    } catch (error: unknown) {
      toast({
        title: 'Move Failed',
        description: getErrorMessage(error, 'Unable to move drawer to limbo.'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDrawer = async (drawerId: string) => {
    if (drawerPendingById[drawerId]) return;
    try {
      await removeDrawer(drawerId);
      if (heldDrawerId === drawerId) setHeldDrawerId(null);
    } catch (error: unknown) {
      toast({
        title: 'Failed to Delete Drawer',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUnit = async () => {
    if (!unitPendingDelete) return;

    const targetUnit = unitPendingDelete;
    const hasDrawers = pendingUnitHasDrawers;
    const selectedDeleteMode = deleteMode;

    setUnitPendingDelete(null);
    setDeleteBusy(true);
    try {
      if (hasDrawers) {
        if (selectedDeleteMode === 'move') {
          await moveDrawersInUnitToLimbo(targetUnit.id);
        } else {
          await deleteDrawersInUnit(targetUnit.id);
        }
      }

      await removeUnit(targetUnit.id);
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
    toast({ title: 'Invite code copied!' });
    window.setTimeout(() => setInviteCodeCopied(false), 2000);
  };

  if (unitsLoading || drawersLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ToplineHeader title="Drawer Planner" userId={userId} displayName={household.displayName} onSignOut={onSignOut} showAppSwitcher />

      <div className="mx-auto hidden max-w-5xl px-4 pt-6 md:block">
        <nav className="hidden w-full grid-cols-2 gap-0.5 rounded-lg border border-[hsl(var(--grid-sticky-line))] bg-[hsl(var(--switch-off))] p-1 text-muted-foreground md:grid">
          {drawersNavItems.map(({ path, icon: Icon, label }) => {
            const fullPath = `${basePath}${path}`;
            const active = location.pathname === fullPath || (!basePath && location.pathname === path);
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(fullPath)}
                className={`inline-flex items-center justify-center gap-0 sm:gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${active ? 'bg-background text-foreground' : 'text-foreground hover:bg-background/50'}`}
              >
                <Icon className="hidden h-4 w-4 sm:inline" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <MobileBottomNav
        items={drawersNavItems}
        isActive={(path) => {
          const fullPath = `${basePath}${path}`;
          return location.pathname === fullPath || (!basePath && location.pathname === path);
        }}
        onNavigate={(path) => navigate(`${basePath}${path}`)}
      />

      {isPlannerRoute && (
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-24 md:pb-6">
        <div className="mb-4 space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold leading-none tracking-tight">Units</h2>
              <Button variant="outline-success" size="sm" className="gap-1.5" onClick={openCreateUnitDialog} disabled={creatingUnit}>
                <Plus className="h-4 w-4" />
                Unit
              </Button>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-stretch">
              {units.map((unit, idx) => {
                const isUnitPending = !!unitPendingById[unit.id];

                return (
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
                            <Button variant="outline" size="icon" title="Unit Actions" className="-mt-0.5 -mr-0.5 h-7 w-7 shrink-0" disabled={isUnitPending || deleteBusy}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem disabled={isUnitPending || deleteBusy} onClick={() => openEditUnitDialog(unit)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isUnitPending || deleteBusy || idx === 0}
                              onClick={() => void reorder(unit.id, 'up')}
                            >
                              Move Up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isUnitPending || deleteBusy || idx === units.length - 1}
                              onClick={() => void reorder(unit.id, 'down')}
                            >
                              Move Down
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isUnitPending || deleteBusy}
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
                              const isHeldOccupant = heldDrawerId === occupant?.id;
                              const isUnitPending = !!unitPendingById[unit.id];
                              const isOccupantPending = occupant ? !!drawerPendingById[occupant.id] : false;
                              const isCellBusy = isUnitPending || isOccupantPending || heldDrawerPending;
                              const cellClassName = `aspect-square overflow-hidden rounded-sm border text-[11px] text-center transition ${unitCellVisualClass(unit.frame_color, occupant?.drawer_type ?? null)} ${isHeldOccupant ? 'border-[3px] border-warning' : ''}`;

                              if (occupant && !heldDrawer) {
                                return (
                                  <DropdownMenu key={`${unit.id}:${x}:${y}`}>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        disabled={isCellBusy}
                                        className={cellClassName}
                                      >
                                        <span className="block w-full overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] break-normal leading-tight">
                                          {occupant.label?.trim() || ''}
                                        </span>
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="bg-popover">
                                      <DropdownMenuItem disabled={isCellBusy} onClick={() => openEditDrawerDialog(occupant)}>
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem disabled={isCellBusy} onClick={() => setHeldDrawerId(occupant.id)}>
                                        Move
                                      </DropdownMenuItem>
                                      <DropdownMenuItem disabled={isCellBusy} onClick={() => void handleSendDrawerToLimbo(occupant.id)}>
                                        Move to Unassigned
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        disabled={isCellBusy}
                                        onClick={() => void handleDeleteDrawer(occupant.id)}
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
                                  disabled={isCellBusy}
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
                );
              })}

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
                <CardTitle>Unassigned Drawers</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline-success" size="sm" onClick={() => openAddDrawerDialog(null)} disabled={creatingDrawer || heldDrawerPending}>
                    + Drawer
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {limboDrawers.map(drawer => {
                  const held = heldDrawerId === drawer.id;
                  const isDrawerPending = !!drawerPendingById[drawer.id];
                  const limboTileClass = `min-h-16 w-28 flex-none rounded-md border p-2 text-xs transition flex items-center justify-center text-center ${limboDrawerVisualClass(drawer.drawer_type)} ${held ? 'border-[3px] border-warning' : ''}`;

                  return (
                    <DropdownMenu key={drawer.id}>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className={limboTileClass} disabled={isDrawerPending || heldDrawerPending}>
                          <p className="overflow-hidden text-ellipsis text-center [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] break-normal font-medium leading-tight">
                            {drawer.label?.trim() || ''}
                          </p>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="bg-popover">
                        <DropdownMenuItem disabled={isDrawerPending || heldDrawerPending} onClick={() => openEditDrawerDialog(drawer)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={isDrawerPending || heldDrawerPending} onClick={() => setHeldDrawerId(drawer.id)}>
                          Move
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isDrawerPending || heldDrawerPending}
                          onClick={() => void handleDeleteDrawer(drawer.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}

                {limboDrawers.length === 0 && (
                  <p className="text-xs text-muted-foreground">No drawers in limbo.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      )}

      {isConfigRoute && (
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-24 md:pb-6">
        <Card>
          <CardHeader>
            <CardTitle>Invite Collaborators</CardTitle>
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
            {pendingUnitHasDrawers ? (
              <AlertDialogDescription>
                Choose what to do with drawers currently in {unitPendingDelete?.name || 'this unit'}.
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription>
                Delete {unitPendingDelete?.name || 'this unit'}?
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          {pendingUnitHasDrawers && (
            <AlertDialogBody className="space-y-2">
              <Button
                type="button"
                variant={deleteMode === 'move' ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setDeleteMode('move')}
              >
                Move Drawers to Limbo
              </Button>
              <Button
                type="button"
                variant={deleteMode === 'delete' ? 'destructive' : 'outline'}
                className="w-full"
                onClick={() => setDeleteMode('delete')}
              >
                Delete Drawers
              </Button>
            </AlertDialogBody>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUnit}
              disabled={deleteBusy}
              className={deleteMode === 'delete' || !pendingUnitHasDrawers ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {deleteBusy ? 'Deleting...' : 'Delete'}
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
        open={addDrawerDialogOpen}
        onOpenChange={open => {
          if (!open) resetAddDrawerDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{addDrawerTarget ? 'Add Drawer to Cubby' : 'Add Drawer to Limbo'}</DialogTitle>
            {addDrawerTarget && (
              <DialogDescription>
                {`Create a new drawer for ${addTargetUnit?.name || 'selected unit'} cubby (${addDrawerTarget.cubbyX}, ${addDrawerTarget.cubbyY}).`}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogBody>
            <form id="add-drawer-form" onSubmit={handleAddDrawer} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="modalDrawerLabel">Label</Label>
                <Input
                  id="modalDrawerLabel"
                  value={newDrawerLabel}
                  onChange={event => setNewDrawerLabel(event.target.value)}
                  placeholder="Books"
                  className="h-10 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                  <Label htmlFor="modalDrawerType">Drawer Type</Label>
                <Select value={newDrawerType} onValueChange={value => setNewDrawerType(value as DrawerType)}>
                  <SelectTrigger id="modalDrawerType" className="h-10 text-sm">
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
            <Button variant="outline" type="button" onClick={resetAddDrawerDialog} disabled={addDrawerBusy}>
              Cancel
            </Button>
            <Button type="submit" form="add-drawer-form" disabled={addDrawerBusy || creatingDrawer}>
              {addDrawerBusy ? 'Saving...' : 'Save Drawer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDrawerDialogOpen}
        onOpenChange={open => {
          if (!open) resetEditDrawerDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Drawer</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form id="edit-drawer-form" onSubmit={handleSaveEditDrawer} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="editDrawerLabel">Label</Label>
                <Input
                  id="editDrawerLabel"
                  value={editDrawerLabel}
                  onChange={event => setEditDrawerLabel(event.target.value)}
                  placeholder="Books"
                  className="h-10 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editDrawerType">Drawer Type</Label>
                <Select value={editDrawerType} onValueChange={value => setEditDrawerType(value as DrawerType)}>
                  <SelectTrigger id="editDrawerType" className="h-10 text-sm">
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
            <Button variant="outline" type="button" onClick={resetEditDrawerDialog} disabled={editDrawerBusy}>
              Cancel
            </Button>
            <Button type="submit" form="edit-drawer-form" disabled={editDrawerBusy || !editDrawerId}>
              {editDrawerBusy ? 'Saving...' : 'Save Drawer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
