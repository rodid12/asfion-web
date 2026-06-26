// Página del módulo Lluvias.
//
// KPIs y charts diseñados a partir de los chunks de Métricas en la app
// mobile (sub-tab Lluvias) — replicamos el mismo modelo mental: serie
// mensual + ranking por campo, más KPIs de mm acumulados, días con
// lluvia y máximo en un día.

import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
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
import { CalendarDaysIcon, CloudRainIcon, DropletIcon, MapPinIcon } from 'lucide-react';
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
import { EmptyModule } from '@/components/EmptyModule';
import { formatNumber } from '@/lib/utils';
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';
import type { Campo, Lluvia } from '@/data/types';

interface Props {
  lluvias: Lluvia[];
  campos: Campo[];
}

export function LluviasPage({ lluvias, campos }: Props) {
  const [filtros, setFiltros] = useState<SimpleFiltros>(SIMPLE_FILTROS_DEFAULT);

  const filtradas = useMemo(() => {
    const desde = rangoDesde(filtros.rango);
    return lluvias.filter(l => {
      if (desde && l.fecha < desde) return false;
      if (filtros.campoId !== 'todos' && l.campoId !== filtros.campoId) return false;
      return true;
    });
  }, [lluvias, filtros]);

  // Filtro adicional para KPIs/charts agregados: solo lecturas del pluviómetro
  // "principal" de cada campo, según el mapeo que pasó Agus. Los pluviómetros
  // secundarios siguen cargándose (la tabla detalle los muestra todos) pero
  // NO entran en el cálculo de mm acumulados, días con lluvia, ranking ni
  // evolución mensual. Esto replica la fórmula del Power BI del cliente.
  //
  // Mapeo campo (uppercase) → pluviómetro principal (uppercase):
  //   QUIRQUINCHO → PUESTO
  //   AGISOT      → S
  //   ICO POZO    → TANQUI
  //   PICAFLOR    → PUESTO
  //   CAROLINA    → CASCO
  //   PROGRESO    → CASCO
  //   MARGARITA   → CASCO
  const PLUVIOMETRO_PRINCIPAL: Record<string, string> = {
    'QUIRQUINCHO': 'PUESTO',
    'AGISOT':      'S',
    'ICO POZO':    'TANQUI',
    'PICAFLOR':    'PUESTO',
    'CAROLINA':    'CASCO',
    'PROGRESO':    'CASCO',
    'MARGARITA':   'CASCO',
  };
  const campoNombreById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of campos) m.set(c.id, c.nombre);
    return m;
  }, [campos]);
  const lecturasPrincipales = useMemo(() => {
    return filtradas.filter(l => {
      const campoName = (campoNombreById.get(l.campoId) ?? '').toUpperCase().trim();
      const expected = PLUVIOMETRO_PRINCIPAL[campoName];
      if (!expected) return true; // Campo sin mapeo definido → no filtramos (incluimos todo)
      return (l.pluviometro ?? '').toUpperCase().trim() === expected;
    });
  }, [filtradas, campoNombreById]);

  // ---------- KPIs (sobre lecturas del pluviómetro principal) ----------
  const kpis = useMemo(() => {
    const totalMM = lecturasPrincipales.reduce((acc, l) => acc + (Number.isFinite(l.milimetros) ? l.milimetros : 0), 0);
    const diasSet = new Set<string>();
    let maxDia = { fecha: '', mm: 0 };
    lecturasPrincipales.forEach(l => {
      if (l.milimetros > 0) diasSet.add(l.fecha);
      if (l.milimetros > maxDia.mm) maxDia = { fecha: l.fecha, mm: l.milimetros };
    });

    const mmPorCampo = new Map<string, number>();
    lecturasPrincipales.forEach(l => mmPorCampo.set(l.campoId, (mmPorCampo.get(l.campoId) ?? 0) + l.milimetros));
    const [topId, topN] = [...mmPorCampo.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    const topCampo = campos.find(c => c.id === topId)?.nombre ?? '—';

    return {
      totalMM: Math.round(totalMM),
      diasConLluvia: diasSet.size,
      maxDia,
      topCampo,
      topMM: Math.round(topN),
    };
  }, [lecturasPrincipales, campos]);

  // ---------- Serie por mes (sobre lecturas principales) ----------
  const porMes = useMemo(() => {
    const mmPorMes = new Map<string, number>();
    lecturasPrincipales.forEach(l => {
      const key = l.fecha.slice(0, 7);
      mmPorMes.set(key, (mmPorMes.get(key) ?? 0) + l.milimetros);
    });
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return [...mmPorMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, mm]) => {
        const [y, m] = key.split('-');
        const idx = Math.max(0, Math.min(11, parseInt(m ?? '1', 10) - 1));
        return { key, mes: `${MESES[idx]} ${(y ?? '').slice(2)}`, mm: Math.round(mm) };
      });
  }, [lecturasPrincipales]);

  // ---------- Serie por día (sobre lecturas principales) ----------
  // Para que Agus vea la distribución diaria — picos de tormenta vs llovizna
  // sostenida. A diferencia de "Evolución mensual" (totales agregados), acá
  // cada barra/punto es UN día. Si dos pluviómetros principales registraron
  // el mismo día (raro), sumamos. Los días sin lluvia se incluyen con mm=0
  // para que la curva no "salte" visualmente y se vea el ritmo real.
  const porDia = useMemo(() => {
    const mmPorDia = new Map<string, number>();
    lecturasPrincipales.forEach(l => {
      if (!l.fecha) return;
      mmPorDia.set(l.fecha, (mmPorDia.get(l.fecha) ?? 0) + (l.milimetros || 0));
    });
    if (mmPorDia.size === 0) return [];
    // Rellenar días sin lluvia para mostrar la distribución temporal real.
    // Solo si el rango es <= 180 días, para no inflar la serie de gráfico.
    const fechas = [...mmPorDia.keys()].sort();
    const desde = new Date(fechas[0] + 'T00:00:00');
    const hasta = new Date(fechas[fechas.length - 1] + 'T00:00:00');
    const dias = Math.round((hasta.getTime() - desde.getTime()) / 86400000) + 1;
    const out: Array<{ fecha: string; mm: number; label: string }> = [];
    if (dias <= 365) {
      for (let i = 0; i < dias; i++) {
        const d = new Date(desde.getTime() + i * 86400000);
        const key = d.toISOString().slice(0, 10);
        out.push({
          fecha: key,
          mm: Math.round((mmPorDia.get(key) ?? 0) * 10) / 10,
          // Label corto "DD/MM" para el eje X — la fecha completa va en el tooltip.
          label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        });
      }
    } else {
      // Rango muy largo (>1 año) — mostramos solo los días con lluvia.
      for (const f of fechas) {
        const d = new Date(f + 'T00:00:00');
        out.push({
          fecha: f,
          mm: Math.round((mmPorDia.get(f) ?? 0) * 10) / 10,
          label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        });
      }
    }
    return out;
  }, [lecturasPrincipales]);

  // ---------- Ranking por campo (sobre lecturas principales) ----------
  const porCampo = useMemo(() => {
    const mmPorCampo = new Map<string, number>();
    lecturasPrincipales.forEach(l => mmPorCampo.set(l.campoId, (mmPorCampo.get(l.campoId) ?? 0) + l.milimetros));
    return campos
      .map(c => ({ campo: c.nombre, mm: Math.round(mmPorCampo.get(c.id) ?? 0) }))
      .filter(r => r.mm > 0)
      .sort((a, b) => b.mm - a.mm);
  }, [lecturasPrincipales, campos]);

  if (lluvias.length === 0) {
    return <EmptyModule label="lluvias" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lluvias"
        subtitle="Milímetros registrados por pluviómetro a través de todos los campos."
        count={{ value: filtradas.length, label: 'registros' }}
        lastDate={filtradas[0]?.fecha}
        actions={
          <ExportCsvButton
            onClick={() => exportLluvias(filtradas, campos)}
            disabled={filtradas.length === 0}
            count={filtradas.length}
          />
        }
      />

      <SimpleFilterBar filtros={filtros} campos={campos} onChange={setFiltros} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="mm acumulados"
          value={`${formatNumber(kpis.totalMM)} mm`}
          accent="navy"
          icon={<CloudRainIcon size={18} />}
        />
        <Kpi
          label="Días con lluvia"
          value={formatNumber(kpis.diasConLluvia)}
          accent="orange"
          icon={<CalendarDaysIcon size={18} />}
        />
        <Kpi
          label="Máximo en un día"
          value={`${formatNumber(kpis.maxDia.mm)} mm`}
          sublabel={kpis.maxDia.fecha || '—'}
          accent="terracota"
          icon={<DropletIcon size={18} />}
        />
        <Kpi
          label="Campo top"
          value={kpis.topCampo}
          sublabel={`${formatNumber(kpis.topMM)} mm`}
          accent="navy"
          icon={<MapPinIcon size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Evolución mensual"
          subtitle="mm acumulados por mes"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porMes} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
              <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip formatter={(v: number) => [`${v} mm`, 'Lluvia']} />
              <Bar dataKey="mm" fill="#163349" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="mm" position="top" fontSize={11} fill="#163349" formatter={(v: number) => `${v}`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Por campo" subtitle="Ranking de mm acumulados">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porCampo} layout="vertical" margin={{ top: 8, right: 36, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" horizontal={false} />
              <XAxis type="number" stroke="#6B7280" fontSize={12} />
              <YAxis type="category" dataKey="campo" stroke="#6B7280" fontSize={12} width={80} />
              <Tooltip formatter={(v: number) => [`${v} mm`, 'Lluvia']} />
              <Bar dataKey="mm" radius={[0, 4, 4, 0]}>
                {porCampo.map((_, i) => (
                  <Cell key={i} fill="#FF8409" />
                ))}
                <LabelList dataKey="mm" position="right" fontSize={11} fill="#163349" formatter={(v: number) => `${v}`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Distribución diaria — curva mm vs día.
          Da granularidad fina: picos de tormenta, lluvias sostenidas,
          rachas secas. El bar chart mensual oculta este detalle. */}
      <Card
        title="Distribución diaria"
        subtitle={
          porDia.length === 0
            ? 'Sin lecturas en el período'
            : porDia.length > 90
              ? `${porDia.length} días — escaneá para ver la curva completa`
              : `${porDia.length} días — cada barra es un día`
        }
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={porDia} margin={{ top: 16, right: 16, left: -8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#6B7280"
              fontSize={10}
              // En rangos largos, mostrar 1 de cada N labels para que no se solapen
              interval={porDia.length > 60 ? Math.floor(porDia.length / 12) : 'preserveStartEnd'}
            />
            <YAxis stroke="#6B7280" fontSize={12} unit=" mm" />
            <Tooltip
              formatter={(v: number) => [`${v} mm`, 'Lluvia']}
              labelFormatter={(_, p) => {
                const item = p?.[0]?.payload as { fecha?: string } | undefined;
                return item?.fecha ?? '';
              }}
            />
            <Area
              type="monotone"
              dataKey="mm"
              stroke="#163349"
              fill="#163349"
              fillOpacity={0.35}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

    </div>
  );
}

// Export CSV de lluvias — una fila por lectura de pluviómetro.
function exportLluvias(rows: Lluvia[], campos: Campo[]): void {
  const campoNombre = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;
  const cols: CsvColumn<Lluvia>[] = [
    { header: 'Fecha',          value: r => r.fecha },
    { header: 'Campo',          value: r => campoNombre(r.campoId) },
    { header: 'Pluviómetro',    value: r => r.pluviometro },
    { header: 'mm',             value: r => r.milimetros },
    { header: 'Cargado por',    value: r => r.usuarioEmail },
    { header: 'Fecha de carga', value: r => r.createdAt },
  ];
  const csv = rowsToCsv(rows, cols);
  downloadCsv(csv, csvFilename('lluvias'));
}

