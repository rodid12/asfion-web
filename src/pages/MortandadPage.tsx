// Página del módulo Mortandad.
//
// KPIs: total muertes, categoría top, causa top, campo top.
// Charts: por categoría, por causa, por campo, evolución mensual.

import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangleIcon, MapPinIcon, SkullIcon, TagIcon } from 'lucide-react';
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
import type { Campo, Mortandad } from '@/data/types';

interface Props {
  mortandad: Mortandad[];
  campos: Campo[];
}

export function MortandadPage({ mortandad, campos }: Props) {
  const [filtros, setFiltros] = useState<SimpleFiltros>(SIMPLE_FILTROS_DEFAULT);

  const filtradas = useMemo(() => {
    const desde = rangoDesde(filtros.rango);
    return mortandad.filter(m => {
      if (desde && m.fecha < desde) return false;
      if (filtros.campoId !== 'todos' && m.campoId !== filtros.campoId) return false;
      return true;
    });
  }, [mortandad, filtros]);

  // ---------- KPIs + chart data ----------
  const { porCampo, porCategoria, porCausa, porMes, topCampo, topCategoria, topCausa } = useMemo(() => {
    const byCampo = new Map<string, number>();
    const byCat = new Map<string, number>();
    const byCausa = new Map<string, number>();
    const byMes = new Map<string, number>();

    filtradas.forEach(m => {
      byCampo.set(m.campoId, (byCampo.get(m.campoId) ?? 0) + 1);
      const cat = m.categoria || 'Sin categoría';
      byCat.set(cat, (byCat.get(cat) ?? 0) + 1);
      const causa = m.causaTipo ?? 'Sin especificar';
      byCausa.set(causa, (byCausa.get(causa) ?? 0) + 1);
      const mes = m.fecha.slice(0, 7);
      byMes.set(mes, (byMes.get(mes) ?? 0) + 1);
    });

    const porCampo = campos
      .map(c => ({ campo: c.nombre, n: byCampo.get(c.id) ?? 0 }))
      .filter(r => r.n > 0)
      .sort((a, b) => b.n - a.n);
    const porCategoria = [...byCat.entries()]
      .map(([categoria, n]) => ({ categoria, n }))
      .sort((a, b) => b.n - a.n);
    const porCausa = [...byCausa.entries()]
      .map(([causa, n]) => ({ causa, n }))
      .sort((a, b) => b.n - a.n);

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const porMes = [...byMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, n]) => {
        const [y, m] = key.split('-');
        const idx = Math.max(0, Math.min(11, parseInt(m ?? '1', 10) - 1));
        return { mes: `${MESES[idx]} ${(y ?? '').slice(2)}`, n };
      });

    return {
      porCampo, porCategoria, porCausa, porMes,
      topCampo: porCampo[0] ?? null,
      topCategoria: porCategoria[0] ?? null,
      topCausa: porCausa[0] ?? null,
    };
  }, [filtradas, campos]);

  if (mortandad.length === 0) {
    return <EmptyModule label="muertes" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mortandad"
        subtitle="Animales muertos (fuera de parto) — agrupado por categoría, causa y campo."
        count={{ value: filtradas.length, label: 'eventos' }}
        lastDate={filtradas[0]?.fecha}
        actions={
          <ExportCsvButton
            onClick={() => exportMortandad(filtradas, campos)}
            disabled={filtradas.length === 0}
            count={filtradas.length}
          />
        }
      />

      <SimpleFilterBar filtros={filtros} campos={campos} onChange={setFiltros} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Total muertes"
          value={formatNumber(filtradas.length)}
          accent="terracota"
          icon={<SkullIcon size={18} />}
        />
        <Kpi
          label="Categoría top"
          value={topCategoria?.categoria ?? '—'}
          sublabel={topCategoria ? `${formatNumber(topCategoria.n)} animales` : ''}
          accent="navy"
          icon={<TagIcon size={18} />}
        />
        <Kpi
          label="Causa top"
          value={topCausa?.causa ?? '—'}
          sublabel={topCausa ? `${formatNumber(topCausa.n)} casos` : ''}
          accent="navy"
          icon={<AlertTriangleIcon size={18} />}
        />
        <Kpi
          label="Campo top"
          value={topCampo?.campo ?? '—'}
          sublabel={topCampo ? `${formatNumber(topCampo.n)} eventos` : ''}
          accent="orange"
          icon={<MapPinIcon size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Evolución mensual"
          subtitle="Muertes registradas por mes"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porMes} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
              <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip />
              <Bar dataKey="n" name="Muertes" fill="#C9823F" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="n" position="top" fontSize={11} fill="#163349" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Causa de muerte" subtitle="Distribución de causas">
          <CausaMuerteDonut data={porCausa} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Por categoría" subtitle="Animales más afectados" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porCategoria} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
              <XAxis dataKey="categoria" stroke="#6B7280" fontSize={11} angle={-15} textAnchor="end" height={60} interval={0} />
              <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="n" name="Muertes" fill="#163349" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="n" position="top" fontSize={11} fill="#163349" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Por campo" subtitle="Ranking">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porCampo} layout="vertical" margin={{ top: 8, right: 36, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" horizontal={false} />
              <XAxis type="number" stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="campo" stroke="#6B7280" fontSize={12} width={90} />
              <Tooltip />
              <Bar dataKey="n" radius={[0, 4, 4, 0]}>
                {porCampo.map((_, i) => <Cell key={i} fill="#FF8409" />)}
                <LabelList dataKey="n" position="right" fontSize={11} fill="#163349" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// Export CSV de mortandad — una fila por evento.
function exportMortandad(rows: Mortandad[], campos: Campo[]): void {
  const campoNombre = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;
  const cols: CsvColumn<Mortandad>[] = [
    { header: 'Fecha',           value: r => r.fecha },
    { header: 'Campo',           value: r => campoNombre(r.campoId) },
    { header: 'Lote',            value: r => r.loteId ?? '' },
    { header: 'Categoría',       value: r => r.categoria },
    { header: 'Actividad',       value: r => r.actividad ?? '' },
    { header: 'Causa tipo',      value: r => r.causaTipo ?? '' },
    { header: 'Causa detalle',   value: r => r.causaDetalle ?? '' },
    { header: 'Caravana color',  value: r => r.caravanaColor ?? '' },
    { header: 'Caravana número', value: r => r.caravanaNumero ?? '' },
    { header: 'Observaciones',   value: r => r.observaciones ?? '' },
    { header: 'Cargado por',     value: r => r.usuarioEmail },
    { header: 'Fecha de carga',  value: r => r.createdAt },
  ];
  const csv = rowsToCsv(rows, cols);
  downloadCsv(csv, csvFilename('mortandad'));
}

// Donut de Causa de muerte — replica el patrón del Power BI que pidió el
// cliente. Asigna colores deterministas por nombre de causa, fallback a
// paleta cíclica para causas nuevas. Leyenda a la derecha con conteo y %.
function CausaMuerteDonut({ data }: { data: Array<{ causa: string; n: number }> }) {
  // Paleta brand para las causas más frecuentes en Ganaderas. Conservamos
  // los nombres del Power BI del cliente pero reasignamos los hex a la
  // paleta brand: Tristeza (la dominante) en orange, status reales en
  // amber/danger/terracota, descriptivos neutros en navy/blueSoft/gris.
  // Para causas nuevas que no estén acá, ciclamos por CHART_PALETTE.
  const FIXED: Record<string, string> = {
    'Tristeza':              '#FF8409', // orange brand (dominante)
    'Distocia':              '#D89425', // amber (warning)
    'Rabia':                 '#C9423F', // danger
    'Problema respiratorio': '#163349', // navy (descriptivo)
    'Sin identificar':       '#C9823F', // terracota
    'Sin especificar':       '#9AA3A8', // gris neutro (sin info)
    'Callo en un pozo':      '#6B9DBE', // blueSoft (templado, on-brand)
    'Tristeza/Anaplas':      '#FFCB95', // peach (variante de Tristeza)
  };
  const FALLBACK = ['#163349', '#FF8409', '#FFCB95', '#C9823F', '#6B9DBE', '#D89425', '#0F2535', '#3FAE5A'];

  let fallbackIdx = 0;
  const serie = data
    .filter(d => d.n > 0)
    .map(d => ({
      name: d.causa,
      value: d.n,
      fill: FIXED[d.causa] ?? FALLBACK[(fallbackIdx++) % FALLBACK.length],
    }));

  const total = serie.reduce((acc, s) => acc + s.value, 0);
  if (total === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-asfion-muted">
        Sin causas registradas
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4">
      <div className="w-full md:w-[50%] h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={serie}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
            >
              {serie.map(s => <Cell key={s.name} fill={s.fill} />)}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [`${v} casos`, n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda con nombre, conteo y %. Compatible con el patrón visual
          del Power BI (etiqueta + número + porcentaje). */}
      <div className="flex-1 flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
        {serie.map(s => (
          <div key={s.name} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: s.fill }}
            />
            <span className="flex-1 truncate font-semibold text-asfion-navy" title={s.name}>
              {s.name}
            </span>
            <span className="tabular-nums text-asfion-muted">{s.value}</span>
            <span className="tabular-nums text-asfion-muted w-12 text-right">
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

