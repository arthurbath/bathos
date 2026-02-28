import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { GarageDueItem } from '@/modules/garage/types/garage';

function formatNullable(value: number | null): string {
  if (value === null) return '—';
  return String(value);
}

function DueBucketCard({
  title,
  description,
  items,
  tone,
}: {
  title: string;
  description: string;
  items: GarageDueItem[];
  tone: 'destructive' | 'warning' | 'info' | 'success' | 'default';
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
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No services in this bucket.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.service.id} className="rounded-md border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.service.name}</p>
                  <p className="text-xs text-muted-foreground">{item.service.type}</p>
                </div>
                <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <p>Remaining Miles: {formatNullable(item.remainingMiles)}</p>
                  <p>Remaining Months: {formatNullable(item.remainingMonths)}</p>
                  <p>Due Date: {item.dueDate ?? '—'}</p>
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
    notDue: GarageDueItem[];
    excluded: GarageDueItem[];
  };
}

export function GarageDueView({ grouped }: GarageDueViewProps) {
  return (
    <div className="grid gap-4">
      <DueBucketCard
        title="Due"
        description="At or beyond a due threshold."
        items={grouped.due}
        tone="destructive"
      />
      <DueBucketCard
        title="Upcoming"
        description="Within your upcoming thresholds."
        items={grouped.upcoming}
        tone="info"
      />
      <DueBucketCard
        title="Not Due"
        description="Not yet within due thresholds."
        items={grouped.notDue}
        tone="success"
      />
      <DueBucketCard
        title="History Only"
        description="No interval configured. Excluded from due calculations."
        items={grouped.excluded}
        tone="default"
      />
    </div>
  );
}
