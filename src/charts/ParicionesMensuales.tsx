import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Paricion } from '@/data/types';
import { CHART_BRAND, EVENTO_COLOR } from './palette';

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
          {/* En este chart específico, navy lleva el área protagonista
              (Nacimientos = la masa grande de datos) y orange acentúa la
              serie secundaria (Retactos). Es una excepción consciente al
              mapeo EVENTO_COLOR — en una AreaChart, navy "pesa" mejor que
              orange como área dominante; orange queda mejor como acento.
              Para donuts/badges seguimos usando EVENTO_COLOR (Nacimiento
              orange). Muertes y Abortos son solo líneas para no saturar
              áreas superpuestas. */}
          <linearGradient id="gNavy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_BRAND.navy} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_BRAND.navy} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gOrange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_BRAND.orange} stopOpacity={0.4} />
            <stop offset="95%" stopColor={CHART_BRAND.orange} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_BRAND.border} vertical={false} />
        <XAxis dataKey="mes" stroke={CHART_BRAND.textMuted} fontSize={12} tickMargin={8} />
        <YAxis stroke={CHART_BRAND.textMuted} fontSize={12} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
        <Area type="monotone" dataKey="nacimientos" name="Nacimientos" stroke={CHART_BRAND.navy}    strokeWidth={2.5} fill="url(#gNavy)"   dot={{ r: 2 }} />
        <Area type="monotone" dataKey="retactos"    name="Retactos"    stroke={CHART_BRAND.orange}  strokeWidth={2}   fill="url(#gOrange)" dot={{ r: 2 }} />
        <Area type="monotone" dataKey="muertes"     name="Muertes"     stroke={EVENTO_COLOR.Muerte} strokeWidth={2}   fill="transparent"   dot={{ r: 2 }} />
        <Area type="monotone" dataKey="abortos"     name="Abortos"     stroke={EVENTO_COLOR.Aborto} strokeWidth={2}   fill="transparent"   strokeDasharray="4 3" dot={{ r: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
