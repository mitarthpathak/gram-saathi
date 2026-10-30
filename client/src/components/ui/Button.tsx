import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const VARIANTS = {
  primary:
    'bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-soft hover:brightness-110 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-600 disabled:shadow-none',
  secondary:
    'bg-white text-brand-800 ring-2 ring-brand-600/25 hover:bg-brand-50 hover:ring-brand-600 disabled:text-slate-500 disabled:ring-slate-200',
  soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100 disabled:text-slate-500',
  ghost: 'text-brand-800 hover:bg-brand-50 disabled:text-slate-500',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-300 disabled:text-slate-600',
};

const SIZES = {
  sm: 'min-h-12 rounded-full px-4 text-base',
  md: 'min-h-12 rounded-2xl px-4 text-base',
  lg: 'min-h-14 rounded-2xl px-5 text-lg',
  xl: 'min-h-16 rounded-2xl px-6 text-xl',
};

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}

/** Large, high-contrast button. type="button" by default so it never submits a form by accident. */
export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-bold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
