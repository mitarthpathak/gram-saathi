import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-card bg-white p-4 shadow-soft ring-1 ring-ink/5', className)}
      {...props}
    />
  );
}
