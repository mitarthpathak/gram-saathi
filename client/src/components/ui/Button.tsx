import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const VARIANTS = {
  primary:
    'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-slate-300 disabled:text-slate-600',
  secondary:
    'border-2 border-brand-700 bg-white text-brand-800 hover:bg-brand-50 disabled:border-slate-300 disabled:text-slate-500',
  ghost: 'text-brand-800 hover:bg-brand-50 disabled:text-slate-500',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-300 disabled:text-slate-600',
};

const SIZES = {
  md: 'min-h-11 px-4 text-base',
  lg: 'min-h-14 px-5 text-lg',
  xl: 'min-h-16 px-6 text-xl',
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
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
