import React from 'react';
import { CalendarRangeIcon, LockIcon } from 'lucide-react';
import type { CampaniaOperativa } from '@/data/types';

interface Props {
  campanias: CampaniaOperativa[];
  seleccionada: CampaniaOperativa;
  onChange: (id: string) => void;
}

function fecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function CampaniaOperativaBar({ campanias, seleccionada, onChange }: Props) {
  return (
    <div className={seleccionada.activa
      ? 'border-b border-asfion-borderSoft bg-asfion-navyDeep text-white'
      : 'border-b border-amber-300 bg-amber-50 text-amber-950'}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2 sm:gap-3">
        {seleccionada.activa ? <CalendarRangeIcon size={15} /> : <LockIcon size={14} />}
        <span className="text-[11px] uppercase tracking-wider font-bold opacity-70">Campaña</span>
        <select
          value={seleccionada.id}
          onChange={e => onChange(e.target.value)}
          className={seleccionada.activa
            ? 'bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-asfion-orange [&>option]:text-asfion-navyDeep'
            : 'bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400'}
          aria-label="Campaña operativa"
        >
          {campanias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <span className="text-xs tabular-nums opacity-80">
          {fecha(seleccionada.fechaInicio)} – {fecha(seleccionada.fechaFin)}
        </span>
        <span className={seleccionada.activa
          ? 'ml-auto rounded-full bg-asfion-orange px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-asfion-navyDeep'
          : 'ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-amber-900'}
        >
          {seleccionada.activa ? 'ACTUAL' : 'HISTÓRICO · SOLO CONSULTA'}
        </span>
        <span className="basis-full sm:basis-auto text-[10px] opacity-65">
          Pariciones: hasta el 31/03 del cierre reproductivo.
        </span>
      </div>
    </div>
  );
}
