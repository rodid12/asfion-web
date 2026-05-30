// "Pariciones por grupo (cabeza / cuerpo / cola)".
//
// Pedido del cliente final: la info por grupo de vaca (vacasGrupo) es clave
// para entender el rodeo — "cabeza" parió primero (vacas adultas, ciclo
// adelantado), "cuerpo" el centro de la curva, "cola" las que llegan tarde
// (suelen ser primíparas o problema reproductivo). Mirar las muertes y
// abortos por grupo permite detectar qué cohorte tiene más problemas.
//
// Visual: barras agrupadas por grupo, con stack por tipo de evento
// (nacimientos / retactos / muertes / abortos). Cada grupo es una columna
// vertical alta para que se lea de una pasada.

import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Paricion, VacasGrupo } from '@/data/types';

interface Props { data: Paricion[]; }

// Orden semántico cabeza → cuerpo → cola (ciclo reproductivo).
// Mantenemos el casing exacto del catálogo: "Vaca cuerpo" tiene singular
// distinto a "Vacas cabeza" / "Vaca cola" — fragilidad del legado, no la
// tocamos acá.
const GRUPO_ORDEN: VacasGrupo[] = ['Vacas cabeza', 'Vaca cuerpo', 'Vaca cola'];

// Etiquetas cortas para el eje X (cabe en cualquier ancho de pantalla).
const GRUPO_LABEL: Record<VacasGrupo, string> = {
  'Vacas cabeza': 'Cabeza',
  'Vaca cuerpo':  'Cuerpo',
  'Vaca cola':    'Cola',
};

const COLORS = {
  Nacimiento: '#1B4332',
  Retacto:    '#52B788',
  Muerte:     '#C9823F',
  Aborto:     '#C9423F',
};

export function ParicionesPorGrupo({ data }: Props) {
  const serie = useMemo(() => {
    // Inicializamos cada grupo con 0 para que aparezcan los 3 aunque no
    // tengan eventos en el rango filtrado — refuerza que "cola está vacía"
    // es información, no falta de data.
    const init = (g: VacasGrupo) => ({
      grupo: GRUPO_LABEL[g],
      Nacimiento: 0,
      Retacto: 0,
      Muerte: 0,
      Aborto: 0,
      total: 0,
    });
    const byGrupo = new Map<VacasGrupo, ReturnType<typeof init>>(
      GRUPO_ORDEN.map(g => [g, init(g)]),
    );
    for (const p of data) {
      const row = byGrupo.get(p.vacasGrupo);
      if (!row) continue;
      if (p.evento === 'Nacimiento') row.Nacimiento++;
      else if (p.evento === 'Retacto') row.Retacto++;
      else if (p.evento === 'Muerte') row.Muerte++;
      else if (p.evento === 'Aborto') row.Aborto++;
      row.total++;
    }
    return GRUPO_ORDEN.map(g => byGrupo.get(g)!);
  }, [data]);

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={serie} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E0" vertical={false} />
          <XAxis dataKey="grupo" stroke="#6B7280" fontSize={13} />
          <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Nacimiento" stackId="x" fill={COLORS.Nacimiento} />
          <Bar dataKey="Retacto"    stackId="x" fill={COLORS.Retacto} />
          <Bar dataKey="Muerte"     stackId="x" fill={COLORS.Muerte} />
          <Bar dataKey="Aborto"     stackId="x" fill={COLORS.Aborto} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Mini-tabla con totales por grupo — referencia rápida sin tener que
          leer el chart. Útil para reuniones donde proyectan la pantalla. */}
      <div className="grid grid-cols-3 gap-2">
        {serie.map(s => (
          <div key={s.grupo} className="bg-asfion-bg rounded-lg px-3 py-2 text-center">
            <p className="text-xs uppercase font-semibold text-asfion-muted">{s.grupo}</p>
            <p className="text-xl font-extrabold text-asfion-deep tabular-nums">{s.total}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
