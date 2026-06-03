import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Campo, Paricion } from '@/data/types';
import { CHART_BRAND, EVENTO_COLOR } from './palette';

interface Props {
  data: Paricion[];
  campos: Campo[];
}

export function ParicionesPorCampo({ data, campos }: Props) {
  const serie = useMemo(() => {
    const byCampo = new Map<string, { campo: string; nacimientos: number; muertes: number; retactos: number; abortos: number }>();
    for (const c of campos) byCampo.set(c.id, { campo: c.nombre, nacimientos: 0, muertes: 0, retactos: 0, abortos: 0 });
    for (const p of data) {
      const row = byCampo.get(p.campoId);
      if (!row) continue;
      if (p.evento === 'Nacimiento') row.nacimientos++;
      else if (p.evento === 'Muerte') row.muertes++;
      else if (p.evento === 'Retacto') row.retactos++;
      else if (p.evento === 'Aborto') row.abortos++;
    }
    return [...byCampo.values()]
      .sort((a, b) =>
        (b.nacimientos + b.muertes + b.retactos + b.abortos) -
        (a.nacimientos + a.muertes + a.retactos + a.abortos),
      );
  }, [data, campos]);

  // Top label total por campo — sumamos las 4 series. Visible siempre,
  // útil para capturas de pantalla sin pasar mouse encima.
  const serieConTotal = useMemo(
    () => serie.map(r => ({
      ...r,
      total: r.nacimientos + r.retactos + r.muertes + r.abortos,
    })),
    [serie],
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={serieConTotal} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_BRAND.border} vertical={false} />
        <XAxis dataKey="campo" stroke={CHART_BRAND.textMuted} fontSize={12} />
        <YAxis stroke={CHART_BRAND.textMuted} fontSize={12} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
        {/* Colores por evento desde EVENTO_COLOR — el mismo mapeo que usa el
            donut Eventos y la tabla de pariciones. Así Nacimiento es siempre
            orange, Retacto peach, Muerte terracota, Aborto danger. */}
        <Bar dataKey="nacimientos" name="Nacimientos" stackId="x" fill={EVENTO_COLOR.Nacimiento} radius={[0, 0, 0, 0]} />
        <Bar dataKey="retactos"    name="Retactos"    stackId="x" fill={EVENTO_COLOR.Retacto} />
        <Bar dataKey="muertes"     name="Muertes"     stackId="x" fill={EVENTO_COLOR.Muerte} />
        <Bar dataKey="abortos"     name="Abortos"     stackId="x" fill={EVENTO_COLOR.Aborto} radius={[4, 4, 0, 0]}>
          {/* LabelList sobre la última serie del stack — recharts ubica el
              label sobre el top del stack completo, así da el TOTAL del campo. */}
          <LabelList dataKey="total" position="top" fontSize={11} fill={CHART_BRAND.navy} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
