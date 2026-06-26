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
  // es largo para no romper la grilla. NO partimos en líneas (un % o un
  // número partido es ilegible).
  const len = value.length;
  const valueSize =
    len <= 5  ? 'text-xl sm:text-2xl'  :
    len <= 8  ? 'text-lg sm:text-xl'   :
    len <= 11 ? 'text-base sm:text-lg' :
                'text-sm sm:text-base';
  return (
    <div className="bg-white rounded-xl border border-asfion-borderSoft px-3 sm:px-4 py-3 flex flex-col gap-1 min-w-0 overflow-hidden">
      <p
        className={cn(valueSize, 'font-extrabold tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis', accentFg)}
        title={value.length > 8 ? value : undefined}
      >
        {value}
      </p>
      <p className="text-[10px] sm:text-xs uppercase tracking-wide font-semibold text-asfion-muted leading-tight">
        {label}
      </p>
    </div>
  );
}
