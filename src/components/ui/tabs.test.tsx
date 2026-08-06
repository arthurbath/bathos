import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Tabs, TabsList, TabsTrigger } from './tabs';

describe('Tabs', () => {
  it('centers full-height triggers inside the standard-height tab list', () => {
    render(
      <Tabs defaultValue="sign-in">
        <TabsList aria-label="Account Access">
          <TabsTrigger value="sign-in">Sign In</TabsTrigger>
          <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByRole('tablist', { name: 'Account Access' })).toHaveClass(
      'h-10',
      'p-1',
    );
    expect(screen.getByRole('tab', { name: 'Sign In' })).toHaveClass(
      'h-full',
      'items-center',
      'justify-center',
    );
    expect(screen.getByRole('tab', { name: 'Sign In' })).not.toHaveClass('py-1.5');
  });
});
