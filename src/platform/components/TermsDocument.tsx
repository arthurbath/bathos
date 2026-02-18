import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import termsMarkdown from '../../../docs/terms/1.0.0.md?raw';

interface TermsDocumentProps {
  className?: string;
}

export function TermsDocument({ className }: TermsDocumentProps) {
  return (
    <div
      className={cn(
        "text-[15px] leading-7 text-foreground [&_h1]:mt-10 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1:first-child]:mt-0 [&_h2]:mt-12 [&_h2]:pt-2 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2:first-of-type]:mt-8 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:list-outside [&_ul]:space-y-2 [&_ul]:pl-6 [&_li]:pl-1 [&_strong]:font-semibold [&_hr]:my-8 [&_hr]:border-border",
        className,
      )}
    >
      <ReactMarkdown>{termsMarkdown}</ReactMarkdown>
    </div>
  );
}
