// Donut de nacimientos segmentados por Cabeza / Cuerpo / Cola.
//
// Solo cuenta eventos tipo "Nacimiento" — los abortos, muertes y retactos
// quedan afuera. La segmentación viene del helper segmentoPorFecha.
//
// Esta visual es uno de los charts que tu amigo quiere replicar del Power
// BI ("Nacimientos segmentados" en la imagen 2).

import React, { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Campo, Paricion } from '@/data/types';
import { segmentoPorFecha, SEGMENTO_ORDEN } from '@/lib/segmento';

interface Props {
  data: Paricion[];
  campos: Campo[];
}

// Mismos colores que usa el Power BI del cliente (cabeza verde, cuerpo
// azul, cola amarillo). Si el cliente prefiere otra paleta, se cambia acá.
const COLORS: Record<string, string> = {
  Cabeza: '#52B788', // verde lima
  Cuerpo: '#2F4E7E', // azul
  Cola:   '#F5C842', // amarillo
};

export function NacimientosSegmentados({ data, campos }: Props) {
  const nombreById = useMemo(() => new Map(campos.map(c => [c.id, c.nombre])), [campos]);

  const serie = useMemo(() => {
    const counts: Record<string, number> = { Cabeza: 0, Cuerpo: 0, Cola: 0 };
    for (const p of data) {
      if (p.evento !== 'Nacimiento') continue;
      const seg = segmentoPorFecha(p.fecha, nombreById.get(p.campoId) ?? '');
      counts[seg] = (counts[seg] ?? 0) + 1;
    }
    return SEGMENTO_ORDEN.map(s => ({ name: s, value: counts[s] ?? 0, fill: COLORS[s]! }));
  }, [data, nombreById]);

  const total = serie.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-asfion-muted">
        Sin nacimientos en el rango
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={220}>
        <PieChart>
          <Pie data={serie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
            {serie.map(s => <Cell key={s.name} fill={s.fill} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 flex flex-col gap-2">
        {serie.map(s => (
          <div key={s.name} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: s.fill }} />
            <span className="flex-1 font-semibold text-asfion-dark">{s.name}</span>
            <span className="tabular-nums text-asfion-muted">{s.value}</span>
            <span className="tabular-nums text-asfion-muted w-12 text-right">
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
