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
  accent?: 'navy' | 'orange' | 'terracota' | 'danger';
}

export function MiniKpi({ label, value, accent = 'navy' }: Props) {
  const accentFg =
    accent === 'orange'    ? 'text-asfion-orange' :
    accent === 'terracota' ? 'text-asfion-terracota' :
    accent === 'danger'    ? 'text-asfion-danger' :
                             'text-asfion-navyDeep';
  // Misma estrategia que el Kpi grande — bajar font-size cuando el value
  // es largo para no romper la grilla. Los MiniKpi suelen tener valores
  // chicos (%, n) pero por las dudas cubrimos casos largos.
  const len = value.length;
  const valueSize =
    len <= 6  ? 'text-xl sm:text-2xl' :
    len <= 9  ? 'text-base sm:text-xl' :
                'text-sm sm:text-base';
  return (
    <div className="bg-white rounded-xl border border-asfion-borderSoft px-3 sm:px-4 py-3 flex flex-col gap-1 min-w-0 overflow-hidden">
      <p
        className={cn(valueSize, 'font-extrabold tabular-nums leading-tight break-words', accentFg)}
        title={value.length > 9 ? value : undefined}
      >
        {value}
      </p>
      <p className="text-[10px] sm:text-xs uppercase tracking-wide font-semibold text-asfion-muted leading-tight">
        {label}
      </p>
    </div>
  );
}
