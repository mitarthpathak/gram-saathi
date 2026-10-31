import { useId } from 'react';
import { cn } from '@/lib/cn';

/** App mark: a microphone on a leaf-green tile with a marigold sun. Decorative (aria-hidden). */
export function Logo({ className }: { className?: string }) {
  const gradient = useId();
  return (
    <svg aria-hidden viewBox="0 0 48 48" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4cb47f" />
          <stop offset="1" stopColor="#177a4e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${gradient})`} />
      <rect x="18" y="8.5" width="12" height="21" rx="6" fill="#fff" />
      <path
        d="M13.5 22.5a10.5 10.5 0 0 0 21 0M24 33v5.5M18.5 38.5h11"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="37" cy="11" r="4.5" fill="#ffa826" />
    </svg>
  );
}
