import React, { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Paricion } from '@/data/types';
import { CHART_BRAND, EVENTO_COLOR } from './palette';

interface Props { data: Paricion[]; }

// Mapeo semántico unificado con el donut Eventos, la tabla y los demás charts.
const COLORS = EVENTO_COLOR;

export function DistribucionEventos({ data }: Props) {
  const serie = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of data) counts[p.evento] = (counts[p.evento] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data]);

  const total = serie.reduce((a, b) => a + b.value, 0);

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
      <div className="w-full md:w-[50%] h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={serie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
              {serie.map(entry => (
                <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS] ?? CHART_BRAND.textMuted} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 flex flex-col gap-2">
        {serie.map(s => (
          <div key={s.name} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-sm inline-block"
              style={{ backgroundColor: COLORS[s.name as keyof typeof COLORS] ?? CHART_BRAND.textMuted }}
            />
            <span className="flex-1 font-semibold text-asfion-navy">{s.name}</span>
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
