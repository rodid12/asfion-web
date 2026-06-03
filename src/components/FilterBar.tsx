import React from 'react';
import { cn } from '@/lib/utils';
import type { Filtros, RangoFecha } from '@/data/filters';
import type { Campo, EventoParicion } from '@/data/types';

interface Props {
  filtros: Filtros;
  campos: Campo[];
  onChange: (f: Filtros) => void;
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

export function FilterBar({ filtros, campos, onChange }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <span className="text-xs uppercase font-semibold text-asfion-muted mr-2">Rango</span>
        {RANGOS.map(([val, label]) => (
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
