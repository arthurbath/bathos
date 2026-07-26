import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TermsDocument } from '@/platform/components/TermsDocument';

describe('TermsDocument', () => {
  it('opts the legal document into native text selection', () => {
    render(<TermsDocument />);

    expect(screen.getByRole('heading', {
      name: 'BathOS Terms of Service and Privacy Policy',
      level: 1,
    }).closest('[data-bathos-text-selection="allow"]')).toHaveAttribute(
      'data-bathos-text-selection',
      'allow',
    );
  });
});
