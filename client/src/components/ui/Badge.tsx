import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const TONES = {
  neutral: 'bg-slate-100 text-slate-800',
  info: 'bg-sky-100 text-sky-900',
  success: 'bg-brand-100 text-brand-900',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-900',
};

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: keyof typeof TONES;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
