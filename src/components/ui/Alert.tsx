import { type ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';

type AlertVariant = 'success' | 'error' | 'info' | 'warning';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const config: Record<AlertVariant, { icon: typeof Info; classes: string }> = {
  success: { icon: CheckCircle, classes: 'bg-green-50 text-green-800 border-green-200' },
  error:   { icon: AlertCircle, classes: 'bg-red-50 text-red-800 border-red-200' },
  info:    { icon: Info,        classes: 'bg-blue-50 text-blue-800 border-blue-200' },
  warning: { icon: AlertTriangle, classes: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
};

export function Alert({ variant, title, children, className }: AlertProps) {
  const { icon: Icon, classes } = config[variant];

  return (
    <div className={cn('flex gap-3 rounded-md border p-4', classes, className)} role="alert">
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div>
        {title && <p className="font-medium mb-1">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}
