// Página del módulo Lluvias.
//
// KPIs y charts diseñados a partir de los chunks de Métricas en la app
// mobile (sub-tab Lluvias) — replicamos el mismo modelo mental: serie
// mensual + ranking por campo, más KPIs de mm acumulados, días con
// lluvia y máximo en un día.

import React, { useMemo, useState } from 'react';
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

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const totalMM = filtradas.reduce((acc, l) => acc + (Number.isFinite(l.milimetros) ? l.milimetros : 0), 0);
    // Días distintos con al menos un registro de lluvia > 0
    const diasSet = new Set<string>();
    let maxDia = { fecha: '', mm: 0 };
    filtradas.forEach(l => {
      if (l.milimetros > 0) diasSet.add(l.fecha);
      if (l.milimetros > maxDia.mm) maxDia = { fecha: l.fecha, mm: l.milimetros };
    });

    // Campo top por mm acumulados
    const mmPorCampo = new Map<string, number>();
    filtradas.forEach(l => mmPorCampo.set(l.campoId, (mmPorCampo.get(l.campoId) ?? 0) + l.milimetros));
    const [topId, topN] = [...mmPorCampo.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    const topCampo = campos.find(c => c.id === topId)?.nombre ?? '—';

    return {
      totalMM: Math.round(totalMM),
      diasConLluvia: diasSet.size,
      maxDia,
      topCampo,
      topMM: Math.round(topN),
    };
  }, [filtradas, campos]);

  // ---------- Serie por mes ----------
  const porMes = useMemo(() => {
    const mmPorMes = new Map<string, number>();
    filtradas.forEach(l => {
      const key = l.fecha.slice(0, 7); // YYYY-MM
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
  }, [filtradas]);

  // ---------- Ranking por campo ----------
  const porCampo = useMemo(() => {
    const mmPorCampo = new Map<string, number>();
    filtradas.forEach(l => mmPorCampo.set(l.campoId, (mmPorCampo.get(l.campoId) ?? 0) + l.milimetros));
    return campos
      .map(c => ({ campo: c.nombre, mm: Math.round(mmPorCampo.get(c.id) ?? 0) }))
      .filter(r => r.mm > 0)
      .sort((a, b) => b.mm - a.mm);
  }, [filtradas, campos]);

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

