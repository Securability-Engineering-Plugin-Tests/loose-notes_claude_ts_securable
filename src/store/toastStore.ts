// Toast notification store — Analyzability: isolated notification concern

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  readonly id: string;
  readonly type: ToastType;
  readonly message: string;
  readonly duration: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, message, duration = 4000) => {
    const id = `toast-${++nextId}`;
    const toast: Toast = { id, type, message, duration };
    set((state) => ({ toasts: [...state.toasts, toast] }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// Convenience hooks
export const useToast = () => {
  const addToast = useToastStore((s) => s.addToast);
  return {
    success: (msg: string) => addToast('success', msg),
    error:   (msg: string) => addToast('error', msg),
    info:    (msg: string) => addToast('info', msg),
    warning: (msg: string) => addToast('warning', msg),
  };
};
