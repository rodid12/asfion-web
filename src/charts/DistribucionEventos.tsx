import React, { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Paricion } from '@/data/types';

interface Props { data: Paricion[]; }

const COLORS: Record<string, string> = {
  Nacimiento: '#1B4332',
  Retacto:    '#52B788',
  Muerte:     '#C9823F',
  Aborto:     '#C9423F',
};

export function DistribucionEventos({ data }: Props) {
  const serie = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of data) counts[p.evento] = (counts[p.evento] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data]);

  const total = serie.reduce((a, b) => a + b.value, 0);

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width="50%" height={220}>
        <PieChart>
          <Pie data={serie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
            {serie.map(entry => (
              <Cell key={entry.name} fill={COLORS[entry.name] ?? '#6B7280'} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 flex flex-col gap-2">
        {serie.map(s => (
          <div key={s.name} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-sm inline-block"
              style={{ backgroundColor: COLORS[s.name] ?? '#6B7280' }}
            />
            <span className="flex-1 font-semibold text-asfion-dark">{s.name}</span>
            <span className="tabular-nums text-asfion-muted">{s.value}</span>
            <span className="tabular-nums text-asfion-muted w-12 text-right">
              {total ? ((s.value / total) * 100).toFixed(1) : '0'}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
