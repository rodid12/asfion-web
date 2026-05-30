import React, { useMemo } from 'react';
import type { Paricion } from '@/data/types';

interface Props { data: Paricion[]; }

export function SexoYAsistencia({ data }: Props) {
  const nacimientos = useMemo(() => data.filter(p => p.evento === 'Nacimiento'), [data]);
  const total = nacimientos.length;

  const sexo = useMemo(() => {
    const c = { Macho: 0, Hembra: 0, Orejano: 0 };
    for (const p of nacimientos) if (p.sexo) c[p.sexo]++;
    return c;
  }, [nacimientos]);

  const asistencia = useMemo(() => {
    const c = { Si: 0, No: 0, sin: 0 };
    for (const p of nacimientos) {
      if (p.asistencia === 'Si') c.Si++;
      else if (p.asistencia === 'No') c.No++;
      else c.sin++;
    }
    return c;
  }, [nacimientos]);

  const pctAsistencia = total ? (asistencia.Si / total) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs uppercase font-semibold text-asfion-muted mb-3">Sexo</p>
        {total === 0 ? (
          <p className="text-sm text-asfion-muted italic">Sin nacimientos en el período.</p>
        ) : (
          <div className="space-y-2">
            {(['Macho', 'Hembra', 'Orejano'] as const).map(s => {
              const n = sexo[s];
              const pct = total ? (n / total) * 100 : 0;
              const bg = s === 'Macho' ? 'bg-asfion-dark' : s === 'Hembra' ? 'bg-asfion-lime' : 'bg-asfion-terracota';
              return (
                <div key={s}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="font-semibold text-asfion-dark">{s}</span>
                    <span className="tabular-nums text-asfion-muted">{n} · {pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-asfion-bg rounded-full overflow-hidden">
                    <div className={`${bg} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-asfion-borderSoft">
        <p className="text-xs uppercase font-semibold text-asfion-muted mb-2">Asistencia en nacimientos</p>
        <p className="text-3xl font-extrabold text-asfion-dark tabular-nums">
          {total ? (pctAsistencia * 100).toFixed(1) : '0'}%
          <span className="ml-2 text-sm font-semibold text-asfion-muted">({asistencia.Si} de {total})</span>
        </p>
      </div>
    </div>
  );
}
