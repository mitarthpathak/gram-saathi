import { createContext, useContext } from 'react';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastApi {
  /** Shows a short message at the bottom of the screen for a few seconds. */
  show: (message: string, tone?: ToastTone) => void;
}

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** The visible toasts, read by <ToastViewport> inside the app shell. */
export const ToastListContext = createContext<ToastItem[]>([]);

export function useToast(): ToastApi {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>');
  return toast;
}
