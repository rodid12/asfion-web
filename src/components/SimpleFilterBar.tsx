// Filtros compartidos por los módulos no-Pariciones (Lluvias, Mortandad,
// Pastoreo): rango de fecha + campo. Sin filtro por "evento" porque ese
// concepto es específico de Pariciones.
//
// Diseño calcado del FilterBar de Pariciones para consistencia visual.

import React from 'react';
import { cn } from '@/lib/utils';
import type { Campo } from '@/data/types';
import type { RangoFecha } from '@/data/filters';

export interface SimpleFiltros {
  rango: RangoFecha;
  campoId: string | 'todos';
}

export const SIMPLE_FILTROS_DEFAULT: SimpleFiltros = {
  rango: '90d',
  campoId: 'todos',
};

interface Props {
  filtros: SimpleFiltros;
  campos: Campo[];
  onChange: (f: SimpleFiltros) => void;
  /** Por defecto los presets son 7d/30d/90d/12m/Todo. Algunos módulos quieren otro mix. */
  rangos?: Array<[RangoFecha, string]>;
}

const DEFAULT_RANGOS: Array<[RangoFecha, string]> = [
  ['7d',  '7d'],
  ['30d', '30d'],
  ['90d', '90d'],
  ['12m', '12m'],
  ['todo', 'Todo'],
];

// Mismo SELECT_CLS que FilterBar — hover peach + foco orange, transición suave.
const SELECT_CLS =
  'bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy ' +
  'hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition cursor-pointer';

export function SimpleFilterBar({ filtros, campos, onChange, rangos }: Props) {
  const presets = rangos ?? DEFAULT_RANGOS;

  return (
    <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <span className="text-xs uppercase font-semibold text-asfion-muted mr-2">Rango</span>
        {presets.map(([val, label]) => (
          <button
            key={val}
            onClick={() => onChange({ ...filtros, rango: val })}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-semibold transition',
              filtros.rango === val
                ? 'bg-asfion-navy text-white'
                : 'bg-asfion-bg text-asfion-navy hover:bg-asfion-orangeSoft/25',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="h-8 w-px bg-asfion-borderSoft" />

      <div className="flex items-center gap-2">
        <span className="text-xs uppercase font-semibold text-asfion-muted">Campo</span>
        <select
          value={filtros.campoId}
          onChange={e => onChange({ ...filtros, campoId: e.target.value })}
          className={SELECT_CLS}
        >
          <option value="todos">Todos</option>
          {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
    </div>
  );
}

/**
 * Convierte el preset de rango en una fecha ISO "desde" (YYYY-MM-DD).
 * Devuelve null si el preset es "todo".
 *
 * Calculado contra `today` para tests deterministas; en producción usar
 * `new Date()`.
 */
export function rangoDesde(r: RangoFecha, today = new Date()): string | null {
  if (r === 'todo') return null;
  const d = new Date(today);
  if (r === '7d') d.setDate(d.getDate() - 7);
  else if (r === '30d') d.setDate(d.getDate() - 30);
  else if (r === '90d') d.setDate(d.getDate() - 90);
  else if (r === '12m') d.setMonth(d.getMonth() - 12);
  return d.toISOString().slice(0, 10);
}
