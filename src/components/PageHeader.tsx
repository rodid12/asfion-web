// Header reutilizable para las páginas de módulo del dashboard.
//
// Antes cada página (Pariciones, Lluvias, Mortandad, Pastoreo, Compras)
// repetía el mismo patrón inline: <h2> + subtitle + count + last date +
// ExportCsv. Hubo drift natural en spacing, colores y orden a medida que
// cada página fue evolucionando.
//
// Ahora todas usan PageHeader y se ven idénticas. Si querés cambiar el
// tamaño del título o ajustar la jerarquía, cambia un solo lugar.

import React from 'react';
import { formatNumber } from '@/lib/utils';

interface Props {
  /** Título grande — ej. "Pariciones", "Compras · Granja Norte". */
  title: string;
  /** Subtítulo descriptivo opcional debajo del título. */
  subtitle?: string;
  /** Métrica principal a la derecha (ej. "1.234 eventos"). */
  count?: { value: number; label: string };
  /** Fecha del último evento — se muestra junto al count. */
  lastDate?: string;
  /** Acciones a la derecha del header (típicamente <ExportCsvButton />). */
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, count, lastDate, actions }: Props) {
  const hasMeta = count !== undefined || lastDate !== undefined;
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-3xl font-extrabold text-asfion-navyDeep leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-asfion-muted mt-1">{subtitle}</p>
        )}
      </div>
      {(hasMeta || actions) && (
        <div className="flex items-center gap-4">
          {hasMeta && (
            <div className="text-sm text-asfion-muted">
              {count && (
                <>
                  <span className="font-semibold text-asfion-navy">
                    {formatNumber(count.value)}
                  </span>{' '}
                  {count.label}
                </>
              )}
              {count && lastDate && <span className="mx-2">·</span>}
              {lastDate && (
                <>
                  últimos datos:{' '}
                  <span className="tabular-nums text-asfion-navy">{lastDate}</span>
                </>
              )}
            </div>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
