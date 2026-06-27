// Mini-KPI compacto. Pensado para la fila de % de eficiencia del Power BI
// (% Destete · % Abortos · % Muertes Señalado · % Nacido Muerto · # Orejanos).
//
// Diferencia con Kpi:
//  - Más chico (1 línea de altura).
//  - Sin icono ni delta.
//  - Sirve para meter 4-6 indicadores en una sola fila.

import React from 'react';
import { cn } from '@/lib/utils';
import { kpiValueClass, KPI_VALUE_BASE, kpiTitleAttr } from '@/lib/kpiSize';

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
  // Tamaño adaptativo compartido con Kpi grande — ver src/lib/kpiSize.ts.
  // Variante 'mini' tiene escalones más conservadores porque el tile es
  // más angosto (típicamente 6 columnas en la grilla).
  return (
    <div className="bg-white rounded-xl border border-asfion-borderSoft px-3 sm:px-4 py-3 flex flex-col gap-1 min-w-0 overflow-hidden">
      <p
        className={cn(kpiValueClass(value, 'mini'), KPI_VALUE_BASE, accentFg)}
        title={kpiTitleAttr(value)}
      >
        {value}
      </p>
      <p className="text-[10px] sm:text-xs uppercase tracking-wide font-semibold text-asfion-muted leading-tight">
        {label}
      </p>
    </div>
  );
}
