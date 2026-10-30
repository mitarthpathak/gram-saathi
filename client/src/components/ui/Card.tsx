import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-3xl bg-white p-4 shadow-soft ring-1 ring-brand-950/5', className)}
      {...props}
    />
  );
}
