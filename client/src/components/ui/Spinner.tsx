import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SpinnerProps {
  /** Visible text next to the spinner. Without it, screen readers hear "Loading". */
  label?: string;
  className?: string;
}

export function Spinner({ label, className }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      <LoaderCircle aria-hidden className="size-6 animate-spin" />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}
