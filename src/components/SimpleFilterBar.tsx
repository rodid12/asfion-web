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
  /** Año específico (YYYY). Si está seteado, anula `rango` — los datos
   *  se filtran de Jan 1 a Dec 31 de ese año. Pensado para revisar
   *  temporadas específicas ("¿cuántas muertes hubo en 2025?"). */
  año?: number;
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
  /** Años disponibles en la data — para poblar el dropdown "Año específico".
   *  Si no se pasa, el dropdown muestra los últimos 5 años hasta el actual. */
  añosDisponibles?: number[];
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

export function SimpleFilterBar({ filtros, campos, onChange, rangos, añosDisponibles }: Props) {
  const presets = rangos ?? DEFAULT_RANGOS;
  // Si el caller no pasa años, mostramos los últimos 5 años hasta el actual.
  // Esto da algo razonable sin necesidad de inspeccionar la data en cada call.
  const añoActual = new Date().getFullYear();
  const años = añosDisponibles && añosDisponibles.length > 0
    ? [...añosDisponibles].sort((a, b) => b - a)
    : [añoActual, añoActual - 1, añoActual - 2, añoActual - 3, añoActual - 4];

  // Cuando el año está seteado, los presets de rango quedan opacos para
  // dejar claro que están desactivados — el año manda.
  const rangoDisabled = filtros.año != null;

  return (
    <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-center gap-3">
      <div className={cn('flex items-center gap-1 flex-wrap', rangoDisabled && 'opacity-40')}>
        <span className="text-xs uppercase font-semibold text-asfion-muted mr-2">Rango</span>
        {presets.map(([val, label]) => (
          <button
            key={val}
            onClick={() => onChange({ ...filtros, rango: val, año: undefined })}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-semibold transition',
              filtros.rango === val && !rangoDisabled
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
        <span className="text-xs uppercase font-semibold text-asfion-muted">Año</span>
        <select
          value={filtros.año ?? ''}
          onChange={e => {
            const v = e.target.value;
            // "" → vuelve a usar el rango. Un número → setea año y anula rango.
            onChange({ ...filtros, año: v === '' ? undefined : parseInt(v, 10) });
          }}
          className={SELECT_CLS}
        >
          <option value="">— Por rango —</option>
          {años.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
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
 *
 * @deprecated usar `enPeriodo(fecha, filtros)` que también maneja el año
 * específico. Mantenido para compat con las pages viejas que solo
 * filtran por rango.
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

/**
 * Evalúa si una fecha ISO ("YYYY-MM-DD") cae dentro del filtro de período.
 *
 * Maneja los dos casos:
 *   - filtros.año seteado → la fecha debe estar entre {año}-01-01 y {año}-12-31
 *   - filtros.año vacío   → la fecha debe ser >= rangoDesde(filtros.rango)
 *
 * Las páginas que usan SimpleFilterBar deberían usar esta función en
 * lugar de `rangoDesde` para soportar también el filtro por año.
 */
export function enPeriodo(
  fecha: string,
  filtros: SimpleFiltros,
  today = new Date(),
): boolean {
  if (filtros.año != null) {
    const a = String(filtros.año);
    return fecha >= `${a}-01-01` && fecha <= `${a}-12-31`;
  }
  const desde = rangoDesde(filtros.rango, today);
  if (!desde) return true; // 'todo' → no filtro
  return fecha >= desde;
}

/**
 * Extrae los años únicos presentes en un array de rows con fecha ISO.
 * Útil para alimentar el dropdown del SimpleFilterBar con años que
 * realmente tienen data (en vez de los últimos 5 hardcodeados).
 */
export function añosEnData(fechas: string[]): number[] {
  const set = new Set<number>();
  for (const f of fechas) {
    if (typeof f === 'string' && f.length >= 4) {
      const y = parseInt(f.slice(0, 4), 10);
      if (Number.isFinite(y) && y > 2000 && y < 2100) set.add(y);
    }
  }
  return [...set].sort((a, b) => b - a);
}
