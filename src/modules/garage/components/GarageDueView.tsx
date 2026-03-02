import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { GarageDueItem } from '@/modules/garage/types/garage';
import { getGarageServiceTypeLabel } from '@/modules/garage/lib/serviceTypes';

function formatMilesValue(value: number): string {
  const absoluteValue = Math.abs(value);
  const inThousands = Math.max(1, Math.round(absoluteValue / 1000));
  return `${inThousands}k`;
}

function formatMonthsStatus(value: number | null): string {
  if (value === null) return 'Months: —';
  if (value === 0) return 'Due now';

  const absoluteValue = Math.abs(value);
  const unit = absoluteValue === 1 ? 'month' : 'months';
  return value > 0 ? `${absoluteValue} ${unit} left` : `${absoluteValue} ${unit} overdue`;
}

function formatMilesStatus(value: number | null): string {
  if (value === null) return 'Miles: —';
  if (value === 0) return 'Due now';

  const absoluteValue = Math.abs(value);
  const unit = Math.round(absoluteValue) === 1 ? 'mile' : 'miles';
  const formattedValue = formatMilesValue(absoluteValue);
  return value > 0 ? `${formattedValue} ${unit} left` : `${formattedValue} ${unit} overdue`;
}

function getPrimaryDueReason(item: GarageDueItem): string {
  const hasMiles = item.remainingMiles !== null;
  const hasMonths = item.remainingMonths !== null;

  if (hasMiles && !hasMonths) return formatMilesStatus(item.remainingMiles);
  if (!hasMiles && hasMonths) return formatMonthsStatus(item.remainingMonths);
  if (!hasMiles && !hasMonths) return 'No interval configured';

  const remainingMiles = item.remainingMiles as number;
  const remainingMonths = item.remainingMonths as number;

  const milesDue = remainingMiles <= 0;
  const monthsDue = remainingMonths <= 0;

  if (milesDue && monthsDue) return formatMilesStatus(remainingMiles);
  if (milesDue) return formatMilesStatus(remainingMiles);
  if (monthsDue) return formatMonthsStatus(remainingMonths);

  const milesInterval = item.service.every_miles;
  const monthsInterval = item.service.every_months;
  const milesRatio = milesInterval ? remainingMiles / milesInterval : null;
  const monthsRatio = monthsInterval ? remainingMonths / monthsInterval : null;

  if (milesRatio !== null && monthsRatio !== null) {
    return milesRatio <= monthsRatio
      ? formatMilesStatus(remainingMiles)
      : formatMonthsStatus(remainingMonths);
  }

  if (milesRatio !== null) return formatMilesStatus(remainingMiles);
  return formatMonthsStatus(remainingMonths);
}

function formatDisplayDate(dateIso: string): string {
  return format(parseISO(dateIso), 'MMM yyyy');
}

function DueBucketCard({
  title,
  items,
  tone,
  showMonitoringToggle,
  onToggleMonitoring,
  monitoringDrafts,
  pendingMonitoringByServiceId,
}: {
  title: string;
  items: GarageDueItem[];
  tone: 'destructive' | 'warning' | 'info' | 'success' | 'default';
  showMonitoringToggle: boolean;
  onToggleMonitoring: (item: GarageDueItem, next: boolean) => void;
  monitoringDrafts: Record<string, boolean>;
  pendingMonitoringByServiceId: Record<string, boolean>;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <Badge variant={tone === 'destructive' ? 'destructive' : 'outline'}>
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No services in this bucket.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.service.id} className="rounded-md border px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.service.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{getGarageServiceTypeLabel(item.service.type)}</p>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <p>{getPrimaryDueReason(item)}</p>
                    </div>
                  </div>
                  {(showMonitoringToggle || item.lastConfirmedNotNeededDate) && (
                    <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5 text-right">
                      {showMonitoringToggle && (
                        <>
                          <Switch
                            checked={monitoringDrafts[item.service.id] ?? item.service.monitoring}
                            disabled={pendingMonitoringByServiceId[item.service.id] === true}
                            onCheckedChange={(next) => onToggleMonitoring(item, next)}
                            aria-label={`Toggle monitoring for ${item.service.name}`}
                          />
                          <span className="text-xs text-muted-foreground">Monitoring</span>
                        </>
                      )}
                      {item.lastConfirmedNotNeededDate && (
                        <span className="max-w-[10rem] text-xs text-muted-foreground">
                          Not needed: {formatDisplayDate(item.lastConfirmedNotNeededDate)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface GarageDueViewProps {
  grouped: {
    due: GarageDueItem[];
    upcoming: GarageDueItem[];
  };
  onUpdateServiceMonitoring: (serviceId: string, monitoring: boolean) => Promise<void>;
}

export function GarageDueView({ grouped, onUpdateServiceMonitoring }: GarageDueViewProps) {
  const [monitoringDrafts, setMonitoringDrafts] = useState<Record<string, boolean>>({});
  const [pendingMonitoringByServiceId, setPendingMonitoringByServiceId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const visibleMonitoringById = new Map(
      [...grouped.due, ...grouped.upcoming].map((item) => [item.service.id, item.service.monitoring]),
    );

    setMonitoringDrafts((previous) => {
      const next = { ...previous };
      let changed = false;

      for (const serviceId of Object.keys(previous)) {
        const persistedMonitoring = visibleMonitoringById.get(serviceId);
        if (persistedMonitoring === undefined || persistedMonitoring === previous[serviceId]) {
          delete next[serviceId];
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [grouped.due, grouped.upcoming]);

  const handleToggleMonitoring = (item: GarageDueItem, next: boolean) => {
    const serviceId = item.service.id;
    const previousValue = monitoringDrafts[serviceId] ?? item.service.monitoring;

    setMonitoringDrafts((previous) => ({ ...previous, [serviceId]: next }));
    setPendingMonitoringByServiceId((previous) => ({ ...previous, [serviceId]: true }));

    void onUpdateServiceMonitoring(serviceId, next)
      .catch(() => {
        setMonitoringDrafts((previous) => ({ ...previous, [serviceId]: previousValue }));
      })
      .finally(() => {
        setPendingMonitoringByServiceId((previous) => {
          const { [serviceId]: _ignored, ...rest } = previous;
          return rest;
        });
      });
  };

  return (
    <div className="grid gap-4">
      <DueBucketCard
        title="Due"
        items={grouped.due}
        tone="destructive"
        showMonitoringToggle
        onToggleMonitoring={handleToggleMonitoring}
        monitoringDrafts={monitoringDrafts}
        pendingMonitoringByServiceId={pendingMonitoringByServiceId}
      />
      <DueBucketCard
        title="Upcoming"
        items={grouped.upcoming}
        tone="info"
        showMonitoringToggle={false}
        onToggleMonitoring={handleToggleMonitoring}
        monitoringDrafts={monitoringDrafts}
        pendingMonitoringByServiceId={pendingMonitoringByServiceId}
      />
    </div>
  );
}
