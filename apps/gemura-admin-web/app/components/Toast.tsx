'use client';

import { useToastStore } from '@/store/toast';
import Icon, {
  faCheckCircle,
  faCircleXmark,
  faTriangleExclamation,
  faInfoCircle,
  faTimes,
} from './Icon';

export default function Toast() {
  const { toasts, remove } = useToastStore();

  const getToastClass = (type: string) => {
    const classes: Record<string, string> = {
      success: 'bg-[#d1e7dd] border-[#badbcc]',
      error: 'bg-[#f8d7da] border-[#f5c2c7]',
      warning: 'bg-[#fff3cd] border-[#ffecb5]',
      info: 'bg-[#cfe2ff] border-[#b6d4fe]',
    };
    return classes[type] || classes.info;
  };

  const getHeaderClass = (type: string) => {
    const classes: Record<string, string> = {
      success: 'bg-[#d1e7dd] text-[#0f5132]',
      error: 'bg-[#f8d7da] text-[#842029]',
      warning: 'bg-[#fff3cd] text-[#664d03]',
      info: 'bg-[#cfe2ff] text-[#084298]',
    };
    return classes[type] || classes.info;
  };

  const getIcon = (type: string) => {
    const icons: Record<string, any> = {
      success: faCheckCircle,
      error: faCircleXmark,
      warning: faTriangleExclamation,
      info: faInfoCircle,
    };
    return icons[type] || faInfoCircle;
  };

  const getTitle = (type: string) => {
    const titles: Record<string, string> = {
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Info',
    };
    return titles[type] || 'Notification';
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] min-w-[300px] max-w-[400px] space-y-2.5" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`border rounded-lg shadow-[0_4px_6px_rgba(0,0,0,0.1)] mb-2.5 ${getToastClass(toast.type)}`}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className={`flex items-center px-4 py-3 border-b border-black/10 ${getHeaderClass(toast.type)}`}>
            <Icon icon={getIcon(toast.type)} size="sm" className="mr-2 flex-shrink-0" />
            <strong className="me-auto text-sm font-semibold">{getTitle(toast.type)}</strong>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              className="ml-auto opacity-50 hover:opacity-100 transition-opacity bg-transparent border-0 text-xl leading-none cursor-pointer p-0"
              aria-label="Close"
            >
              <Icon icon={faTimes} size="sm" />
            </button>
          </div>
          <div className="px-4 py-3 text-sm text-gray-700">{toast.message}</div>
        </div>
      ))}
    </div>
  );
}

