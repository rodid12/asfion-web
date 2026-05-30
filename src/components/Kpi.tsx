import React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string | number;
  delta?: { value: number; label?: string }; // value ya viene como fracción (0.12 = +12%)
  accent?: 'dark' | 'lime' | 'terracota';
  sublabel?: string;
  icon?: React.ReactNode;
}

export function Kpi({ label, value, delta, accent = 'dark', sublabel, icon }: Props) {
  const accentBg =
    accent === 'lime' ? 'bg-asfion-lime/10' :
    accent === 'terracota' ? 'bg-asfion-terracota/10' :
                              'bg-asfion-dark/5';
  const accentFg =
    accent === 'lime' ? 'text-asfion-dark' :
    accent === 'terracota' ? 'text-asfion-terracota' :
                              'text-asfion-dark';

  return (
    <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider font-semibold text-asfion-muted">{label}</p>
        {icon && <span className={cn('p-2 rounded-lg', accentBg, accentFg)}>{icon}</span>}
      </div>
      <p className={cn('text-4xl font-extrabold tabular-nums', accentFg)}>{value}</p>
      <div className="flex items-center gap-2 text-xs">
        {delta !== undefined && (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full font-semibold tabular-nums',
              delta.value >= 0 ? 'bg-asfion-lime/20 text-asfion-dark' : 'bg-asfion-terracota/15 text-asfion-terracota',
            )}
          >
            {delta.value >= 0 ? '▲' : '▼'} {Math.abs(delta.value * 100).toFixed(1)}%
          </span>
        )}
        {(sublabel || delta?.label) && (
          <span className="text-asfion-muted">{sublabel ?? delta?.label}</span>
        )}
      </div>
    </div>
  );
}
