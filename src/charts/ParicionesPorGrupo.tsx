// "Pariciones por grupo (Cabeza / Cuerpo / Cola)".
//
// Pedido del cliente final: la info por grupo es clave para entender
// cómo se distribuye la temporada — "cabeza" pare primero (adultas con
// ciclo adelantado), "cuerpo" el centro de la curva, "cola" las que
// llegan tarde (suelen ser primíparas o problema reproductivo).
//
// IMPORTANTE: la segmentación se calcula a partir de la FECHA del evento
// + nombre del campo (replica la lógica DAX del Power BI del cliente).
// El field `vacasGrupo` que el peón carga en el form se ignora — queda
// como referencia histórica pero el dashboard no lo usa.

import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Campo, Paricion } from '@/data/types';
import { segmentoPorFecha, SEGMENTO_ORDEN, type Segmento } from '@/lib/segmento';
import { CHART_BRAND, EVENTO_COLOR } from './palette';

interface Props {
  data: Paricion[];
  campos: Campo[];
}

// Colores de las 4 series — heredados del mapeo semántico unificado.
const COLORS = EVENTO_COLOR;

export function ParicionesPorGrupo({ data, campos }: Props) {
  // Map campoId → nombre, para pasarle el nombre al helper de segmentación.
  const campoNombreById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of campos) m.set(c.id, c.nombre);
    return m;
  }, [campos]);

  const serie = useMemo(() => {
    // Inicializamos cada segmento con 0 para que aparezcan los 3 aunque
    // no tengan eventos en el rango filtrado.
    const init = (s: Segmento) => ({
      grupo: s as string,
      Nacimiento: 0,
      Retacto: 0,
      Muerte: 0,
      Aborto: 0,
      total: 0,
    });
    const bySeg = new Map<Segmento, ReturnType<typeof init>>(
      SEGMENTO_ORDEN.map(s => [s, init(s)]),
    );
    for (const p of data) {
      const campoNombre = campoNombreById.get(p.campoId) ?? '';
      const seg = segmentoPorFecha(p.fecha, campoNombre);
      const row = bySeg.get(seg);
      if (!row) continue;
      if (p.evento === 'Nacimiento') row.Nacimiento++;
      else if (p.evento === 'Retacto') row.Retacto++;
      else if (p.evento === 'Muerte') row.Muerte++;
      else if (p.evento === 'Aborto') row.Aborto++;
      row.total++;
    }
    return SEGMENTO_ORDEN.map(s => bySeg.get(s)!);
  }, [data, campoNombreById]);

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={serie} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_BRAND.border} vertical={false} />
          <XAxis dataKey="grupo" stroke={CHART_BRAND.textMuted} fontSize={13} />
          <YAxis stroke={CHART_BRAND.textMuted} fontSize={12} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
          <Bar dataKey="Nacimiento" stackId="x" fill={COLORS.Nacimiento} />
          <Bar dataKey="Retacto"    stackId="x" fill={COLORS.Retacto} />
          <Bar dataKey="Muerte"     stackId="x" fill={COLORS.Muerte} />
          <Bar dataKey="Aborto"     stackId="x" fill={COLORS.Aborto} radius={[4, 4, 0, 0]}>
            {/* Total del stack arriba de cada grupo — visible siempre. */}
            <LabelList dataKey="total" position="top" fontSize={12} fill={CHART_BRAND.navy} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-2">
        {serie.map(s => (
          <div key={s.grupo} className="bg-asfion-bg rounded-lg px-3 py-2 text-center">
            <p className="text-xs uppercase font-semibold text-asfion-muted">{s.grupo}</p>
            <p className="text-xl font-extrabold text-asfion-navyDeep tabular-nums">{s.total}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
