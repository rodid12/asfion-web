// Mini-KPI compacto. Pensado para la fila de % de eficiencia del Power BI
// (% Destete · % Abortos · % Muertes Señalado · % Nacido Muerto · # Orejanos).
//
// Diferencia con Kpi:
//  - Más chico (1 línea de altura).
//  - Sin icono ni delta.
//  - Sirve para meter 4-6 indicadores en una sola fila.

import React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  /** Color del número grande. */
  accent?: 'dark' | 'lime' | 'terracota' | 'danger';
}

export function MiniKpi({ label, value, accent = 'dark' }: Props) {
  const accentFg =
    accent === 'lime' ? 'text-asfion-lime' :
    accent === 'terracota' ? 'text-asfion-terracota' :
    accent === 'danger' ? 'text-asfion-danger' :
                            'text-asfion-deep';
  return (
    <div className="bg-white rounded-xl border border-asfion-borderSoft px-4 py-3 flex flex-col gap-1">
      <p className={cn('text-2xl font-extrabold tabular-nums leading-tight', accentFg)}>{value}</p>
      <p className="text-xs uppercase tracking-wide font-semibold text-asfion-muted leading-tight">
        {label}
      </p>
    </div>
  );
}
