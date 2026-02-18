import { getPasswordChecks } from '@/lib/passwordValidation';
import { Check, X } from 'lucide-react';

interface PasswordRequirementsProps {
  password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const checks = getPasswordChecks(password);

  if (!password) {
    return (
      <p className="text-xs text-muted-foreground">
        Must be 8+ characters with uppercase, lowercase, digit, and symbol.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {checks.map(c => (
        <li key={c.label} className="flex items-center gap-1.5 text-xs">
          {c.met ? (
            <Check className="h-3 w-3 text-muted-foreground" />
          ) : (
            <X className="h-3 w-3 text-destructive" />
          )}
          <span className={c.met ? 'text-muted-foreground' : 'text-foreground'}>{c.label}</span>
        </li>
      ))}
    </ul>
  );
}
