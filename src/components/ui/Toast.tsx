import { X } from 'lucide-react';
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, type ToastType } from '@/store/toastStore';
import { cn } from '@/utils/cn';

const config: Record<ToastType, { icon: typeof Info; classes: string }> = {
  success: { icon: CheckCircle, classes: 'bg-green-50 border-green-200 text-green-800' },
  error:   { icon: AlertCircle, classes: 'bg-red-50 border-red-200 text-red-800' },
  info:    { icon: Info,        classes: 'bg-blue-50 border-blue-200 text-blue-800' },
  warning: { icon: AlertTriangle, classes: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => {
        const { icon: Icon, classes } = config[toast.type];
        return (
          <div
            key={toast.id}
            className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md', classes)}
            role="alert"
          >
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
