// Bar chart vertical de Causa de muerte SOBRE PARICIONES.
//
// Replica el chart "Causa de Muerte" del Power BI (imagen 2 del cliente):
// barras de Muerte Señalado / Nacido Muerto / Desconocido, contando solo
// eventos de tipo Muerte/Aborto/Nacimiento que tengan causa_tipo.
//
// Difiere del donut de Mortandad porque acá usamos los registros de
// PARICIONES (donde la causa de muerte viene en `causaTipo`), no la
// tabla mortandad que cuenta muertes de adultos por otras razones.

import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Paricion } from '@/data/types';
import { CHART_BRAND } from './palette';

interface Props { data: Paricion[]; }

const ORDEN = ['Muerte Señalado', 'Nacido Muerto', 'Desconocido'];

// Paleta brand: terracota (warning) para muerte señalada, danger para nacido
// muerto (irreversible), navy para desconocido (categoría neutra/falta dato).
const COLOR_BY_CAUSA: Record<string, string> = {
  'Muerte Señalado': CHART_BRAND.terracota,
  'Nacido Muerto':   CHART_BRAND.danger,
  'Desconocido':     CHART_BRAND.navy,
};

export function CausaDeMuertePariciones({ data }: Props) {
  const serie = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of data) {
      if (!p.causaTipo) continue;
      counts[p.causaTipo] = (counts[p.causaTipo] ?? 0) + 1;
    }
    // Orden fijo (Muerte Señalado primero) + sumar cualquier causa que
    // aparezca y no esté en el orden canónico (al final).
    const ordered = ORDEN.map(name => ({ name, value: counts[name] ?? 0 }));
    Object.entries(counts).forEach(([name, value]) => {
      if (!ORDEN.includes(name)) ordered.push({ name, value });
    });
    return ordered.filter(r => r.value > 0);
  }, [data]);

  if (serie.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-asfion-muted">
        Sin causas de muerte registradas
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={serie} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_BRAND.border} vertical={false} />
        <XAxis dataKey="name" stroke={CHART_BRAND.textMuted} fontSize={12} />
        <YAxis stroke={CHART_BRAND.textMuted} fontSize={12} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {serie.map(s => (
            <Cell key={s.name} fill={COLOR_BY_CAUSA[s.name] ?? CHART_BRAND.orange} />
          ))}
          <LabelList dataKey="value" position="top" fontSize={12} fill={CHART_BRAND.navy} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
