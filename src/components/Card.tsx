import React from 'react';
import { cn } from '@/lib/utils';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Card({ title, subtitle, actions, className, children, ...rest }: Props) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-asfion-borderSoft shadow-card overflow-hidden',
        className,
      )}
      {...rest}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-asfion-muted uppercase tracking-wider">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs text-asfion-muted">{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      {/* Cuando NO hay header (sin title/actions) aplicamos pt-5 simétrico
          al pb-5, sino el contenido pegaba contra el borde superior del
          card (ej. el filter bar de PastoreoPage). */}
      <div className={cn(!title && !actions ? 'p-5' : 'px-5 pb-5')}>{children}</div>
    </div>
  );
}
