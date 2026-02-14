import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { frequencyLabels, needsParam } from '@/lib/frequency';
import type { FrequencyType } from '@/types/fairshare';

interface FrequencySelectorProps {
  type: FrequencyType;
  param: number | null;
  onTypeChange: (t: FrequencyType) => void;
  onParamChange: (p: number | null) => void;
}

export function FrequencySelector({ type, param, onTypeChange, onParamChange }: FrequencySelectorProps) {
  return (
    <div className="flex gap-2">
      <div className="flex-1 space-y-1">
        <Label className="text-xs text-muted-foreground">Frequency</Label>
        <Select value={type} onValueChange={(v) => onTypeChange(v as FrequencyType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(frequencyLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {needsParam(type) && (
        <div className="w-20 space-y-1">
          <Label className="text-xs text-muted-foreground">
            {type === 'every_n_weeks' ? 'N' : 'K'}
          </Label>
          <Input
            type="number"
            min={1}
            value={param ?? ''}
            onChange={(e) => onParamChange(e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      )}
    </div>
  );
}
