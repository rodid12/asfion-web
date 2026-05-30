import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Paricion } from '@/data/types';

interface Props { data: Paricion[]; }

export function ParicionesMensuales({ data }: Props) {
  const serie = useMemo(() => {
    // agrupamos por YYYY-MM
    const byMes = new Map<string, { mes: string; nacimientos: number; muertes: number; abortos: number; retactos: number }>();
    for (const p of data) {
      const mes = p.fecha.slice(0, 7);
      if (!byMes.has(mes)) byMes.set(mes, { mes, nacimientos: 0, muertes: 0, abortos: 0, retactos: 0 });
      const b = byMes.get(mes)!;
      if (p.evento === 'Nacimiento') b.nacimientos++;
      else if (p.evento === 'Muerte') b.muertes++;
      else if (p.evento === 'Aborto') b.abortos++;
      else if (p.evento === 'Retacto') b.retactos++;
    }
    return [...byMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={serie} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gLime" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#52B788" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#52B788" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1B4332" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#1B4332" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E0" vertical={false} />
        <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} tickMargin={8} />
        <YAxis stroke="#6B7280" fontSize={12} />
        <Tooltip />
        <Area type="monotone" dataKey="nacimientos" name="Nacimientos" stroke="#1B4332" strokeWidth={2} fill="url(#gDark)" />
        <Area type="monotone" dataKey="retactos"    name="Retactos"    stroke="#52B788" strokeWidth={2} fill="url(#gLime)" />
        <Area type="monotone" dataKey="muertes"     name="Muertes"     stroke="#C9823F" strokeWidth={2} fill="transparent" />
        <Area type="monotone" dataKey="abortos"     name="Abortos"     stroke="#C9423F" strokeWidth={2} fill="transparent" strokeDasharray="4 3" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
