import * as React from 'react';
import type { LucideProps } from 'lucide-react';

export const SnakeIcon = React.forwardRef<SVGSVGElement, LucideProps>(({
  color = 'currentColor',
  size = 24,
  strokeWidth = 2,
  absoluteStrokeWidth,
  children,
  ...props
}, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 17 C8 17 4 14 3 10" />
    <path d="M12 17 L12 20" />
    <path d="M12 20 L10 21.5" />
    <path d="M12 20 L14 21.5" />
    <path d="M12 3 C19 3 22 6 21 10" />
    <path d="M16 8.5 L16 10" />
    <path d="M21 10 C20 14 16 17 12 17" />
    <path d="M3 10 C1.5 6 5 3 12 3" />
    <path d="M8 8.5 L8 10" />
    {children}
  </svg>
));

SnakeIcon.displayName = 'SnakeIcon';
