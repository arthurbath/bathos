import { Badge } from '@/components/ui/badge';

export function TaskCountBadge({
  count,
  label = 'Items',
}: {
  count: number;
  label?: string;
}) {
  return (
    <Badge
      variant="secondary"
      aria-label={`${count} ${label}`}
      data-task-count-badge
      className="h-5 min-w-5 justify-center border-0 px-1.5 py-0 text-[11px] font-semibold tabular-nums"
    >
      {count}
    </Badge>
  );
}
