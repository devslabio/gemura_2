import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message: string, type: ToastType = 'info', duration?: number) => {
    const toast: Toast = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      type,
      duration: duration || (type === 'error' ? 7000 : 5000),
    };
    set((state) => ({ toasts: [...state.toasts, toast] }));

    if (toast.duration) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== toast.id),
        }));
      }, toast.duration);
    }
  },
  success: (message: string, duration?: number) => {
    useToastStore.getState().show(message, 'success', duration);
  },
  error: (message: string, duration?: number) => {
    useToastStore.getState().show(message, 'error', duration);
  },
  warning: (message: string, duration?: number) => {
    useToastStore.getState().show(message, 'warning', duration);
  },
  info: (message: string, duration?: number) => {
    useToastStore.getState().show(message, 'info', duration);
  },
  remove: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

