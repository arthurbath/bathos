import { describe, expect, it } from 'vitest';
import { buttonVariants } from '@/components/ui/button';

describe('buttonVariants', () => {
  it('renders the ghost variant as the canonical borderless treatment', () => {
    const className = buttonVariants({ variant: 'ghost' });

    expect(className).toContain('border-transparent');
    expect(className).toContain('bg-transparent');
    expect(className).toContain('text-foreground');
    expect(className).toContain('focus:border-ring');
    expect(className).not.toContain('border-primary');
  });
});
