import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { use, useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import {
  ToastContext,
  ToastListContext,
  type ToastApi,
  type ToastItem,
  type ToastTone,
} from './useToast';

const TONES: Record<ToastTone, string> = {
  info: 'bg-slate-900 text-white',
  success: 'bg-brand-700 text-white',
  error: 'bg-red-700 text-white',
};

const ICONS = { info: Info, success: CircleCheck, error: CircleAlert };

const DURATION_MS = 4000;

let lastToastId = 0;
const nextToastId = () => ++lastToastId;

/** Provides `useToast()`. The toasts themselves render in <ToastViewport>. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextToastId();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, DURATION_MS);
  }, []);

  const toastApi = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext value={toastApi}>
      <ToastListContext value={toasts}>{children}</ToastListContext>
    </ToastContext>
  );
}

/** Toasts above the bottom navigation, positioned in the nearest positioned ancestor (the app). */
export function ToastViewport() {
  const toasts = use(ToastListContext);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-50 flex flex-col gap-2 px-4">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex animate-fade-up items-start gap-2 rounded-2xl px-4 py-3 text-base font-semibold shadow-lift',
              TONES[toast.tone],
            )}
          >
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
