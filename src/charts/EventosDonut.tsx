// Donut "Eventos" del Power BI del cliente (imagen 2).
// Compara Nacimientos vs Muertes + Abortos (más Retactos como categoría
// chica) para ver de un vistazo la proporción "vivos vs no logrados".

import React, { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Paricion } from '@/data/types';

interface Props { data: Paricion[]; }

// Verde dominante para nacimientos (lo positivo), terracota para
// muertes/abortos. Retacto pintado azul para no confundirlo.
const COLORS: Record<string, string> = {
  Nacimientos: '#7CB342',
  'Muertes + Abortos': '#C9823F',
  Retactos: '#3E8AB4',
};

export function EventosDonut({ data }: Props) {
  const serie = useMemo(() => {
    let nac = 0, muertes = 0, abortos = 0, retactos = 0;
    for (const p of data) {
      if (p.evento === 'Nacimiento') nac++;
      else if (p.evento === 'Muerte') muertes++;
      else if (p.evento === 'Aborto') abortos++;
      else if (p.evento === 'Retacto') retactos++;
    }
    const out: Array<{ name: string; value: number }> = [];
    if (nac > 0) out.push({ name: 'Nacimientos', value: nac });
    if (muertes + abortos > 0) out.push({ name: 'Muertes + Abortos', value: muertes + abortos });
    if (retactos > 0) out.push({ name: 'Retactos', value: retactos });
    return out;
  }, [data]);

  const total = serie.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-asfion-muted">
        Sin eventos en el rango
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={200}>
        <PieChart>
          <Pie data={serie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
            {serie.map(s => <Cell key={s.name} fill={COLORS[s.name] ?? '#6B7280'} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 flex flex-col gap-2">
        {serie.map(s => (
          <div key={s.name} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[s.name] ?? '#6B7280' }} />
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
