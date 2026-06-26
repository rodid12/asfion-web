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

  // Tamaño de fuente del value según largo del string. Importante:
  //   1. NUNCA partimos el número en líneas (whitespace-nowrap) — un
  //      "$2.014.760.100" cortado en "$2.014.760.1" / "00" es ilegible.
  //   2. Reducimos el font-size en escalones más agresivos para que el
  //      número largo entre en 1 sola línea aunque el card sea angosto.
  //   3. Si después de la reducción al mínimo (text-base) todavía no
  //      entra, overflow-hidden recorta y el title tooltip muestra el
  //      valor completo en hover.
  //
  //   <  8 chars   →  4xl (default, "$235M" o "1.234")
  //   8-10 chars   →  2xl ("12.345.678", "1.769 cab")
  //   11-13 chars  →  xl  ("$15.234.567")
  //   14+ chars    →  base ("$2.014.760.100")
  const valueStr = String(value);
  const len = valueStr.length;
  const valueSize =
    len <= 7   ? 'text-2xl sm:text-3xl lg:text-4xl' :
    len <= 10  ? 'text-xl sm:text-2xl lg:text-3xl' :
    len <= 13  ? 'text-lg sm:text-xl lg:text-2xl'  :
                 'text-base sm:text-lg lg:text-xl';

  return (
    <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 sm:p-5 flex flex-col gap-2 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-asfion-muted truncate">{label}</p>
        {icon && <span className={cn('p-1.5 sm:p-2 rounded-lg flex-shrink-0', accentBg, accentFg)}>{icon}</span>}
      </div>
      {/* whitespace-nowrap: el número va en una sola línea siempre.
          overflow-hidden + text-ellipsis en el card padre garantizan que
          si no entra ni siquiera al tamaño más chico, se trunque con
          "..." en lugar de escaparse. title tooltip muestra el valor
          completo en hover. */}
      <p
        className={cn(valueSize, 'font-extrabold tabular-nums whitespace-nowrap overflow-hidden text-ellipsis leading-tight', accentFg)}
        title={valueStr.length > 10 ? valueStr : undefined}
      >
        {value}
      </p>
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
