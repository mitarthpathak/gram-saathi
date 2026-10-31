import { cn } from '@/lib/cn';

/** A phone with a microphone on its screen: the "Open app" icon. Decorative (aria-hidden). */
export function PhoneMicIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
    >
      <rect x="5.5" y="1.75" width="13" height="20.5" rx="3.25" />
      <rect x="10.5" y="6.5" width="3" height="5.5" rx="1.5" />
      <path d="M8.75 10.5a3.25 3.25 0 0 0 6.5 0M12 13.75v1.75M10 18.75h4" />
    </svg>
  );
}
