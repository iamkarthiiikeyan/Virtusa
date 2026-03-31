import { ReactNode } from 'react';

interface DashboardCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export default function DashboardCard({
  title,
  children,
  className = '',
  actions,
}: DashboardCardProps) {
  return (
    <div
      className={`bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl overflow-hidden ${className}`}
    >
      {title && (
        <div className="px-6 py-4 border-b border-slate-800/50 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
          {actions}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
