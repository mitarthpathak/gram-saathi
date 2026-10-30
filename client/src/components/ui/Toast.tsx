import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ToastContext, type ToastApi, type ToastTone } from './useToast';

const TONES: Record<ToastTone, string> = {
  info: 'bg-slate-900 text-white',
  success: 'bg-brand-700 text-white',
  error: 'bg-red-700 text-white',
};

const DURATION_MS = 4000;

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

let lastToastId = 0;
const nextToastId = () => ++lastToastId;

/** Provides `useToast()` and renders the toasts above the bottom navigation. */
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
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto flex max-w-md flex-col gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto rounded-xl px-4 py-3 text-base font-semibold shadow-lg',
              TONES[toast.tone],
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
