import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const VARIANTS = {
  primary:
    'bg-leaf-600 text-white shadow-leaf hover:bg-leaf-700 disabled:bg-paper-deep disabled:text-ink-soft disabled:shadow-none',
  secondary:
    'bg-white text-leaf-700 ring-2 ring-leaf-600/25 hover:bg-leaf-50 hover:ring-leaf-600 disabled:text-ink-soft disabled:ring-ink/10',
  soft: 'bg-leaf-50 text-leaf-700 hover:bg-leaf-100 disabled:text-ink-soft',
  ghost: 'text-leaf-700 hover:bg-leaf-50 disabled:text-ink-soft',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-paper-deep disabled:text-ink-soft',
};

const SIZES = {
  sm: 'min-h-10 rounded-full px-3.5 text-sm',
  md: 'min-h-12 rounded-soft px-4 text-base',
  lg: 'min-h-14 rounded-soft px-5 text-lg',
  xl: 'min-h-16 rounded-card px-6 text-xl',
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
        'inline-flex items-center justify-center gap-2 font-bold transition duration-200 ease-out-soft hover:-translate-y-px active:translate-y-0 active:scale-[0.96] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
