/** Joins class names and skips falsy ones: cn('p-4', isActive && 'bg-brand-700'). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
