// Sub-vista "Entradas" del módulo Pastoreo.
//
// Foco: cuándo y dónde entraron los animales al circuito. Filtramos sobre
// el mismo dataset de Pastoreo, pero solo eventos tipo "Entrada" o
// "Rotacion" (que es una re-entrada a otra parcela). El usuario quiere
// ver el detalle individual de cada movida — cuántas cabezas, qué peso
// promedio, qué fecha.
//
// KPIs (replica conceptual de la página "Entradas" del Power BI):
//   - Total entradas      = cantidad de movimientos tipo Entrada/Rotación
//   - Animales Totales    = SUM(animales) de esos movimientos
//   - Kg Totales          = SUM(animales × kgPromedio)
//   - Peso Promedio       = AVG(kgPromedio) sobre stays con dato
//   - Fecha más reciente  = MAX(fecha)
//
// Charts:
//   - Movimientos por mes (bar chart) — cuándo se concentran las largadas
//   - Por circuito + categoría (tabla detallada)

import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarDaysIcon,
  ScaleIcon,
  TrendingUpIcon,
  UsersIcon,
  WeightIcon,
} from 'lucide-react';
import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import {
  SimpleFilterBar,
  SIMPLE_FILTROS_DEFAULT,
  rangoDesde,
  type SimpleFiltros,
} from '@/components/SimpleFilterBar';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { PageHeader } from '@/components/PageHeader';
import { formatNumber } from '@/lib/utils';
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';
import type { Campo, Circuito, Pastoreo } from '@/data/types';

interface Props {
  pastoreo: Pastoreo[];
  campos: Campo[];
  circuitos: Circuito[];
}

function isEntrada(evento?: string): boolean {
  if (!evento) return false;
  const e = evento.toLowerCase();
  return e === 'entrada' || e === 'rotacion' || e === 'rotación';
}

export function PastoreoEntradasView({ pastoreo, campos, circuitos }: Props) {
  const [filtros, setFiltros] = useState<SimpleFiltros>(SIMPLE_FILTROS_DEFAULT);

  const circuitoMap = useMemo(
    () => new Map(circuitos.map(c => [c.id, c])),
    [circuitos],
  );
  const campoMap = useMemo(
    () => new Map(campos.map(c => [c.id, c.nombre])),
    [campos],
  );

  // Filtramos por: rango + campo (filtros estándar) + tipo de evento.
  const filtrados = useMemo(() => {
    const desde = rangoDesde(filtros.rango);
    return pastoreo.filter(p => {
      if (!isEntrada(p.evento)) return false;
      if (desde && p.fecha < desde) return false;
      if (filtros.campoId !== 'todos' && p.campoId !== filtros.campoId) return false;
      return true;
    });
  }, [pastoreo, filtros]);

  const kpis = useMemo(() => {
    let animales = 0;
    let kgTotales = 0;
    let sumKg = 0;
    let nConKg = 0;
    let maxFecha = '';
    filtrados.forEach(p => {
      if (p.animales != null) animales += p.animales;
      if (p.kgPromedio != null) {
        sumKg += p.kgPromedio;
        nConKg++;
      }
      if (p.animales != null && p.kgPromedio != null) {
        kgTotales += p.animales * p.kgPromedio;
      }
      if (p.fecha > maxFecha) maxFecha = p.fecha;
    });
    return {
      totalEntradas: filtrados.length,
      animales,
      kgTotales,
      pesoPromedio: nConKg > 0 ? sumKg / nConKg : 0,
      fechaUltima: maxFecha || '—',
    };
  }, [filtrados]);

  // Distribución mensual de entradas — útil para ver patrones de largada
  // estacional (entradas concentradas en mayo/junio = pico de recría).
  const porMes = useMemo(() => {
    const map = new Map<string, { entradas: number; animales: number }>();
    filtrados.forEach(p => {
      const key = p.fecha.slice(0, 7);
      const cur = map.get(key) ?? { entradas: 0, animales: 0 };
      cur.entradas++;
      cur.animales += p.animales ?? 0;
      map.set(key, cur);
    });
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, v]) => {
        const [y, m] = key.split('-');
        const idx = Math.max(0, Math.min(11, parseInt(m ?? '1', 10) - 1));
        return { mes: `${MESES[idx]} ${(y ?? '').slice(2)}`, entradas: v.entradas, animales: v.animales };
      });
  }, [filtrados]);

  if (pastoreo.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-8 text-center text-sm text-asfion-muted">
        Sin movimientos de pastoreo cargados todavía.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entradas"
        subtitle="Movimientos de entrada y rotación al circuito — qué grupo, cuándo, cuánto pesaba."
        count={{ value: filtrados.length, label: 'entradas' }}
        lastDate={kpis.fechaUltima !== '—' ? kpis.fechaUltima : undefined}
        actions={
          <ExportCsvButton
            onClick={() => exportEntradas(filtrados, campoMap, circuitoMap)}
            disabled={filtrados.length === 0}
            count={filtrados.length}
          />
        }
      />

      <SimpleFilterBar filtros={filtros} campos={campos} onChange={setFiltros} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Kpi
          label="Entradas totales"
          value={formatNumber(kpis.totalEntradas)}
          sublabel="Movimientos de Entrada/Rotación"
          accent="orange"
          icon={<TrendingUpIcon size={18} />}
        />
        <Kpi
          label="Animales Totales"
          value={kpis.animales > 0 ? formatNumber(kpis.animales) : '—'}
          sublabel="Cabezas movidas"
          accent="navy"
          icon={<UsersIcon size={18} />}
        />
        <Kpi
          label="Kg Totales"
          value={kpis.kgTotales > 0 ? formatNumber(Math.round(kpis.kgTotales)) : '—'}
          sublabel="Σ animales × peso"
          accent="navy"
          icon={<WeightIcon size={18} />}
        />
        <Kpi
          label="Peso Promedio"
          value={kpis.pesoPromedio > 0 ? `${kpis.pesoPromedio.toFixed(1)} kg` : '—'}
          sublabel="Por animal — promedio de entradas"
          accent="navy"
          icon={<ScaleIcon size={18} />}
        />
        <Kpi
          label="Última entrada"
          value={kpis.fechaUltima}
          accent="terracota"
          icon={<CalendarDaysIcon size={18} />}
        />
      </div>

      <Card title="Entradas por mes" subtitle="Distribución temporal de las largadas">
        {porMes.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-asfion-muted">
            Sin entradas en el período seleccionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porMes} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
              <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="entradas" name="Movimientos" fill="#FF8409" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="entradas" position="top" fontSize={11} fill="#163349" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Detalle de entradas" subtitle="Cada movimiento individual — fecha, parcela, animales, peso">
        <EntradasTabla rows={filtrados} campoMap={campoMap} circuitoMap={circuitoMap} />
      </Card>
    </div>
  );
}

// === Tabla detallada ===

interface TablaProps {
  rows: Pastoreo[];
  campoMap: Map<string, string>;
  circuitoMap: Map<string, Circuito>;
}

function EntradasTabla({ rows, campoMap, circuitoMap }: TablaProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-asfion-muted py-6 text-center italic">Sin entradas en el período.</p>;
  }
  // Ordenadas por fecha descendente — más recientes primero.
  const ordenadas = [...rows].sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
            <th className="py-2 px-2 font-semibold whitespace-nowrap">Fecha</th>
            <th className="py-2 px-2 font-semibold whitespace-nowrap">Evento</th>
            <th className="py-2 px-2 font-semibold whitespace-nowrap">Campo</th>
            <th className="py-2 px-2 font-semibold whitespace-nowrap">Circuito</th>
            <th className="py-2 px-2 font-semibold whitespace-nowrap">Parcela</th>
            <th className="py-2 px-2 font-semibold whitespace-nowrap">Categoría</th>
            <th className="py-2 px-2 font-semibold text-right tabular-nums whitespace-nowrap">Animales</th>
            <th className="py-2 px-2 font-semibold text-right tabular-nums whitespace-nowrap">Peso (kg)</th>
            <th className="py-2 px-2 font-semibold text-right tabular-nums whitespace-nowrap">Kg Total</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map(p => {
            const c = circuitoMap.get(p.circuitoId);
            const kgTotal = (p.animales ?? 0) * (p.kgPromedio ?? 0);
            return (
              <tr key={p.id} className="border-b border-asfion-borderSoft/50 hover:bg-asfion-bg/60 transition">
                <td className="py-2 px-2 tabular-nums text-asfion-navy">{p.fecha}</td>
                <td className="py-2 px-2 text-asfion-muted">{p.evento ?? '—'}</td>
                <td className="py-2 px-2 font-semibold text-asfion-navyDeep">{campoMap.get(p.campoId) ?? p.campoId}</td>
                <td className="py-2 px-2 text-asfion-muted">{c?.nombre ?? p.circuitoId}</td>
                <td className="py-2 px-2 text-asfion-muted">{p.parcelaNumero ?? p.parcelaId}</td>
                <td className="py-2 px-2 text-asfion-muted">{p.categoria}</td>
                <td className="py-2 px-2 tabular-nums text-right">{p.animales != null ? formatNumber(p.animales) : '—'}</td>
                <td className="py-2 px-2 tabular-nums text-right">{p.kgPromedio != null ? p.kgPromedio.toFixed(1) : '—'}</td>
                <td className="py-2 px-2 tabular-nums text-right font-semibold text-asfion-orange">
                  {kgTotal > 0 ? formatNumber(Math.round(kgTotal)) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Export CSV de entradas — una fila por movimiento.
function exportEntradas(
  rows: Pastoreo[],
  campoMap: Map<string, string>,
  circuitoMap: Map<string, Circuito>,
): void {
  const cols: CsvColumn<Pastoreo>[] = [
    { header: 'Fecha',     value: r => r.fecha },
    { header: 'Evento',    value: r => r.evento ?? '' },
    { header: 'Campo',     value: r => campoMap.get(r.campoId) ?? r.campoId },
    { header: 'Circuito',  value: r => circuitoMap.get(r.circuitoId)?.nombre ?? r.circuitoId },
    { header: 'Parcela',   value: r => r.parcelaNumero ?? r.parcelaId },
    { header: 'Categoría', value: r => r.categoria },
    { header: 'Animales',  value: r => r.animales ?? 0 },
    { header: 'Peso prom', value: r => r.kgPromedio ?? 0 },
    { header: 'Kg Total',  value: r => (r.animales ?? 0) * (r.kgPromedio ?? 0) },
    { header: 'Operario',  value: r => r.usuarioEmail },
  ];
  const csv = rowsToCsv(rows, cols);
  downloadCsv(csv, csvFilename('entradas-pastoreo'));
}
