import React from 'react';
import { cn } from '@/lib/utils';
import type { Filtros, RangoFecha } from '@/data/filters';
import type { Campo, EventoParicion } from '@/data/types';
import { presetsCampaña } from './SimpleFilterBar';

interface Props {
  filtros: Filtros;
  campos: Campo[];
  onChange: (f: Filtros) => void;
  /** Años con data — para alimentar el dropdown "Año". Si no se pasa,
   *  el dropdown muestra los últimos 5 años hasta el actual. */
  añosDisponibles?: number[];
}

const RANGOS: Array<[RangoFecha, string]> = [
  ['7d',  '7d'],
  ['30d', '30d'],
  ['90d', '90d'],
  ['12m', '12m'],
  ['todo', 'Todo'],
];

const EVENTOS: Array<EventoParicion | 'todos'> = ['todos', 'Nacimiento', 'Muerte', 'Retacto', 'Aborto'];

// Clases compartidas para los <select> de campo y evento — outline foco
// en orange, hover peach suave, padding/typography consistente con los
// botones del rango.
const SELECT_CLS =
  'bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy ' +
  'hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition cursor-pointer';

export function FilterBar({ filtros, campos, onChange, añosDisponibles }: Props) {
  const añoActual = new Date().getFullYear();
  const años = añosDisponibles && añosDisponibles.length > 0
    ? [...añosDisponibles].sort((a, b) => b - a)
    : [añoActual, añoActual - 1, añoActual - 2, añoActual - 3, añoActual - 4];
  const campañas = presetsCampaña(añosDisponibles);

  const hayCustomRange = !!(filtros.desde && filtros.hasta);
  const hayAño = filtros.año != null;
  const rangoDisabled = hayCustomRange || hayAño;

  // Mismo patrón unificado que SimpleFilterBar.
  const periodoSeleccionado: string = (() => {
    if (hayCustomRange) {
      const m = campañas.find(c => c.desde === filtros.desde && c.hasta === filtros.hasta);
      if (m) return `camp:${m.id}`;
      return 'custom';
    }
    if (hayAño) return `año:${filtros.año}`;
    return '';
  })();

  const onChangePeriodo = (val: string) => {
    if (val === '') {
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
      if (camp) onChange({ ...filtros, año: undefined, desde: camp.desde, hasta: camp.hasta });
      return;
    }
    if (val === 'custom') {
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
        onChange({ ...filtros, año: undefined });
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-center gap-3">
      <div className={cn('flex items-center gap-1 flex-wrap', rangoDisabled && 'opacity-40')}>
        <span className="text-xs uppercase font-semibold text-asfion-muted mr-2">Rango</span>
        {RANGOS.map(([val, label]) => (
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
          onChange={e => onChange({ ...filtros, campoId: e.target.value as Filtros['campoId'] })}
          className={SELECT_CLS}
        >
          <option value="todos">Todos</option>
          {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs uppercase font-semibold text-asfion-muted">Evento</span>
        <select
          value={filtros.evento}
          onChange={e => onChange({ ...filtros, evento: e.target.value as Filtros['evento'] })}
          className={SELECT_CLS}
        >
          {EVENTOS.map(ev => <option key={ev} value={ev}>{ev === 'todos' ? 'Todos' : ev}</option>)}
        </select>
      </div>
    </div>
  );
}
