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
  /** Campaña ganadera o rango custom — desde/hasta en ISO (YYYY-MM-DD).
   *  Si AMBOS están seteados, anulan `rango` y `año`. Pensado para
   *  campañas que cruzan el cambio de año (Sep año1 → Mar año2) o
   *  cualquier rango personalizado. Los presets de campaña que se
   *  ofrecen en el dropdown setean estas dos fechas a la vez. */
  desde?: string;
  hasta?: string;
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
  const añoActual = new Date().getFullYear();
  const años = añosDisponibles && añosDisponibles.length > 0
    ? [...añosDisponibles].sort((a, b) => b - a)
    : [añoActual, añoActual - 1, añoActual - 2, añoActual - 3, añoActual - 4];
  const campañas = presetsCampaña(añosDisponibles);

  // Helpers para entender el estado actual del filtro de período.
  const hayCustomRange = !!(filtros.desde && filtros.hasta);
  const hayAño = filtros.año != null;
  const rangoDisabled = hayCustomRange || hayAño;

  // ID del preset de campaña seleccionado (si es uno de los presets).
  // Si el desde/hasta no matchea ningún preset, fue armado a mano → "custom".
  const periodoSeleccionado: string = (() => {
    if (hayCustomRange) {
      const matchCampaña = campañas.find(c => c.desde === filtros.desde && c.hasta === filtros.hasta);
      if (matchCampaña) return `camp:${matchCampaña.id}`;
      return 'custom';
    }
    if (hayAño) return `año:${filtros.año}`;
    return '';
  })();

  // Handler unificado del dropdown período. Setea el modo correspondiente
  // y limpia los otros campos.
  const onChangePeriodo = (val: string) => {
    if (val === '') {
      // Volver al rango.
      onChange({ ...filtros, año: undefined, desde: undefined, hasta: undefined });
      return;
    }
    if (val.startsWith('año:')) {
      const año = parseInt(val.slice(4), 10);
      onChange({ ...filtros, año, desde: undefined, hasta: undefined });
      return;
    }
    if (val.startsWith('camp:')) {
      const id = val.slice(5);
      const camp = campañas.find(c => c.id === id);
      if (camp) {
        onChange({ ...filtros, año: undefined, desde: camp.desde, hasta: camp.hasta });
      }
      return;
    }
    if (val === 'custom') {
      // Si todavía no hay rango custom, inicializo con los últimos 12 meses.
      // El usuario después ajusta con los date inputs.
      if (!filtros.desde || !filtros.hasta) {
        const hoy = new Date();
        const hace12m = new Date(hoy);
        hace12m.setMonth(hace12m.getMonth() - 12);
        onChange({
          ...filtros,
          año: undefined,
          desde: hace12m.toISOString().slice(0, 10),
          hasta: hoy.toISOString().slice(0, 10),
        });
      } else {
        // Ya tenía un rango custom — lo mantengo.
        onChange({ ...filtros, año: undefined });
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-center gap-3">
      <div className={cn('flex items-center gap-1 flex-wrap', rangoDisabled && 'opacity-40')}>
        <span className="text-xs uppercase font-semibold text-asfion-muted mr-2">Rango</span>
        {presets.map(([val, label]) => (
          <button
            key={val}
            onClick={() => onChange({ ...filtros, rango: val, año: undefined, desde: undefined, hasta: undefined })}
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

      {/* Selector unificado de período: año calendario, campaña ganadera
          o custom range. Reemplaza el dropdown viejo de "Año". */}
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase font-semibold text-asfion-muted">Período</span>
        <select
          value={periodoSeleccionado}
          onChange={e => onChangePeriodo(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">— Por rango —</option>
          {campañas.length > 0 && (
            <optgroup label="Campaña ganadera">
              {campañas.map(c => (
                <option key={c.id} value={`camp:${c.id}`}>{c.label}</option>
              ))}
            </optgroup>
          )}
          <optgroup label="Año calendario">
            {años.map(a => <option key={a} value={`año:${a}`}>{a}</option>)}
          </optgroup>
          <option value="custom">Custom (desde – hasta)…</option>
        </select>
      </div>

      {/* Inputs de fecha cuando el modo es custom. Solo visibles cuando
          el usuario eligió Custom o un preset de campaña — para los
          presets se ven los valores pero no son editables, así sabe
          qué rango se está aplicando. */}
      {hayCustomRange && (
        <div className="flex items-center gap-2 bg-asfion-bg/60 rounded-lg px-2 py-1">
          <input
            type="date"
            value={filtros.desde ?? ''}
            onChange={e => onChange({ ...filtros, desde: e.target.value || undefined })}
            className="bg-white border border-asfion-borderSoft rounded px-2 py-1 text-sm font-semibold text-asfion-navy focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange"
            max={filtros.hasta}
          />
          <span className="text-xs text-asfion-muted">–</span>
          <input
            type="date"
            value={filtros.hasta ?? ''}
            onChange={e => onChange({ ...filtros, hasta: e.target.value || undefined })}
            className="bg-white border border-asfion-borderSoft rounded px-2 py-1 text-sm font-semibold text-asfion-navy focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange"
            min={filtros.desde}
          />
        </div>
      )}

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
 * Orden de precedencia (más específico primero):
 *   1. desde + hasta (custom o campaña) → fecha entre ambos inclusive
 *   2. año seteado                       → fecha en {año}-01-01 a {año}-12-31
 *   3. preset de rango                   → fecha >= rangoDesde(rango)
 *
 * Las páginas que usan SimpleFilterBar deberían usar esta función en
 * lugar de `rangoDesde` para soportar todos los modos de filtro.
 */
export function enPeriodo(
  fecha: string,
  filtros: SimpleFiltros,
  today = new Date(),
): boolean {
  // 1. Custom range / campaña (desde + hasta).
  if (filtros.desde && filtros.hasta) {
    return fecha >= filtros.desde && fecha <= filtros.hasta;
  }
  // 2. Año calendario.
  if (filtros.año != null) {
    const a = String(filtros.año);
    return fecha >= `${a}-01-01` && fecha <= `${a}-12-31`;
  }
  // 3. Preset de rango relativo (7d, 30d, etc).
  const desde = rangoDesde(filtros.rango, today);
  if (!desde) return true; // 'todo' → no filtro
  return fecha >= desde;
}

/**
 * Genera presets de campaña ganadera para el dropdown.
 *
 * En ganadería argentina la campaña típica va de septiembre a marzo (el
 * "año productivo" que cruza el cambio de calendario). Los meses pueden
 * variar según cliente, así que también ofrecemos campañas Mar-Sep como
 * inversa (para feedlot / engorde a corral).
 *
 * Devuelve los últimos N años cubiertos. Si `años` viene de los años con
 * data real, generamos campañas que la cubran. Sino, últimos 3 años.
 */
export interface PresetCampaña {
  id: string;        // ej: "campania-24-25"
  label: string;     // ej: "Campaña 24-25 (Sep'24 – Mar'25)"
  desde: string;     // YYYY-MM-DD
  hasta: string;     // YYYY-MM-DD
}

export function presetsCampaña(añosDisponibles?: number[]): PresetCampaña[] {
  const añoActual = new Date().getFullYear();
  const años = añosDisponibles && añosDisponibles.length > 0
    ? [...añosDisponibles].sort((a, b) => b - a).slice(0, 4)
    : [añoActual, añoActual - 1, añoActual - 2];
  const out: PresetCampaña[] = [];
  for (const año of años) {
    // Campaña típica Sep año → Mar año+1
    out.push({
      id: `camp-${año}-${año + 1}`,
      label: `Campaña ${String(año).slice(2)}-${String(año + 1).slice(2)} (Sep–Mar)`,
      desde: `${año}-09-01`,
      hasta: `${año + 1}-03-31`,
    });
  }
  return out;
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
