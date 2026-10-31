import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const TONES = {
  neutral: 'bg-paper-alt text-ink-soft',
  info: 'bg-sky text-sky-900',
  success: 'bg-leaf-100 text-leaf-700',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-900',
  accent: 'bg-marigold-100 text-accent-deep',
};

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: keyof typeof TONES;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-bold',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
