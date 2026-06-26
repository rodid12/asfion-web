import React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string | number;
  delta?: { value: number; label?: string }; // value ya viene como fracción (0.12 = +12%)
  accent?: 'navy' | 'orange' | 'terracota' | 'danger';
  sublabel?: string;
  icon?: React.ReactNode;
}

export function Kpi({ label, value, delta, accent = 'navy', sublabel, icon }: Props) {
  // Acentos: navy (texto + bg tenue) para KPIs neutros; orange para KPIs
  // estrella (CTA / highlight); terracota para warnings; danger para errores
  // fuertes (rojo).
  const accentBg =
    accent === 'orange'    ? 'bg-asfion-orange/10' :
    accent === 'terracota' ? 'bg-asfion-terracota/10' :
    accent === 'danger'    ? 'bg-asfion-danger/10' :
                             'bg-asfion-navy/5';
  const accentFg =
    accent === 'orange'    ? 'text-asfion-orange' :
    accent === 'terracota' ? 'text-asfion-terracota' :
    accent === 'danger'    ? 'text-asfion-danger' :
                             'text-asfion-navy';

  return (
    <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 sm:p-5 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-asfion-muted truncate">{label}</p>
        {icon && <span className={cn('p-1.5 sm:p-2 rounded-lg flex-shrink-0', accentBg, accentFg)}>{icon}</span>}
      </div>
      <p className={cn('text-2xl sm:text-3xl lg:text-4xl font-extrabold tabular-nums break-words', accentFg)}>{value}</p>
      <div className="flex items-center gap-2 text-xs flex-wrap min-w-0">
        {delta !== undefined && (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full font-semibold tabular-nums',
              delta.value >= 0 ? 'bg-asfion-orange/20 text-asfion-navy' : 'bg-asfion-terracota/15 text-asfion-terracota',
            )}
          >
            {delta.value >= 0 ? '▲' : '▼'} {Math.abs(delta.value * 100).toFixed(1)}%
          </span>
        )}
        {(sublabel || delta?.label) && (
          <span className="text-asfion-muted text-[11px] sm:text-xs line-clamp-2">{sublabel ?? delta?.label}</span>
        )}
      </div>
    </div>
  );
}
