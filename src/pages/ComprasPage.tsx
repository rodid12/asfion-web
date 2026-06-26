// Página del módulo Compras del dashboard web.
//
// Replica la lógica del sub-tab Compras de Métricas mobile más algunos
// extras propios del dashboard:
//   - 5 KPIs: Total compras, Cabezas estimadas, Kg netos totales,
//     Inversión total ($ARS), Merma promedio %
//   - Chart "Compras por mes" (BarChart)
//   - Chart "Kg por campo" (BarChart horizontal)
//   - Tabla detalle paginada con todas las columnas
//   - Export CSV con todos los campos del schema

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
import {
  ActivityIcon,
  CoinsIcon,
  PackageIcon,
  PercentIcon,
  ScaleIcon,
  UsersIcon,
} from 'lucide-react';
import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { PageHeader } from '@/components/PageHeader';
import { EmptyModule } from '@/components/EmptyModule';
import {
  SimpleFilterBar,
  SIMPLE_FILTROS_DEFAULT,
  enPeriodo,
  añosEnData,
  type SimpleFiltros,
} from '@/components/SimpleFilterBar';
import { formatNumber } from '@/lib/utils';
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';
import type { Campo, Compra } from '@/data/types';

interface Props {
  compras: Compra[];
  campos: Campo[];
}

// Parsea texto libre tipo "83 machos. 27 hembras" → 110.
// Toma cualquier número entero y los suma. Gross approximation pero útil.
function parseCabezas(txt: string | undefined): number {
  if (!txt) return 0;
  const matches = txt.match(/\d+/g);
  if (!matches) return 0;
  return matches.reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0);
}

export function ComprasPage({ compras, campos }: Props) {
  const [filtros, setFiltros] = useState<SimpleFiltros>(SIMPLE_FILTROS_DEFAULT);

  const añosDisponibles = useMemo(
    () => añosEnData(compras.map(c => c.fecha)),
    [compras],
  );

  const filtradas = useMemo(() => {
    return compras.filter(c => {
      if (!enPeriodo(c.fecha, filtros)) return false;
      if (filtros.campoId !== 'todos' && c.campoId !== filtros.campoId) return false;
      return true;
    });
  }, [compras, filtros]);

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const total = filtradas.length;
    let cabezas = 0;
    let kgTotales = 0;
    let inversion = 0;
    let mermaSum = 0;
    let mermaCount = 0;
    filtradas.forEach(c => {
      cabezas += parseCabezas(c.cantCabYCat);
      const kg = Number.isFinite(c.kgNetosDestino) ? c.kgNetosDestino : 0;
      kgTotales += kg;
      if (c.precio != null && Number.isFinite(c.precio)) {
        inversion += c.precio * kg;
      }
      if (c.mermaPorcentaje != null && Number.isFinite(c.mermaPorcentaje)) {
        mermaSum += c.mermaPorcentaje;
        mermaCount++;
      }
    });
    return {
      total,
      cabezas,
      kgTotales: Math.round(kgTotales),
      inversion: Math.round(inversion),
      mermaPromedio: mermaCount > 0 ? mermaSum / mermaCount : 0,
      mermaCount,
    };
  }, [filtradas]);

  // ---------- Compras por mes ----------
  const porMes = useMemo(() => {
    const counts = new Map<string, { compras: number; kg: number }>();
    filtradas.forEach(c => {
      const key = c.fecha.slice(0, 7); // YYYY-MM
      const entry = counts.get(key) ?? { compras: 0, kg: 0 };
      entry.compras++;
      entry.kg += Number.isFinite(c.kgNetosDestino) ? c.kgNetosDestino : 0;
      counts.set(key, entry);
    });
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, e]) => {
        const [y, m] = key.split('-');
        const idx = Math.max(0, Math.min(11, parseInt(m ?? '1', 10) - 1));
        return {
          mes: `${MESES[idx]} ${(y ?? '').slice(2)}`,
          compras: e.compras,
          kg: Math.round(e.kg),
        };
      });
  }, [filtradas]);

  // ---------- Kg por campo ----------
  const porCampo = useMemo(() => {
    const map = new Map<string, { kg: number; count: number; inversion: number }>();
    filtradas.forEach(c => {
      const entry = map.get(c.campoId) ?? { kg: 0, count: 0, inversion: 0 };
      const kg = Number.isFinite(c.kgNetosDestino) ? c.kgNetosDestino : 0;
      entry.kg += kg;
      entry.count++;
      if (c.precio != null && Number.isFinite(c.precio)) {
        entry.inversion += c.precio * kg;
      }
      map.set(c.campoId, entry);
    });
    return campos
      .map(cmp => {
        const e = map.get(cmp.id);
        if (!e) return null;
        return {
          campo: cmp.nombre,
          kg: Math.round(e.kg),
          count: e.count,
          inversion: Math.round(e.inversion),
        };
      })
      .filter((r): r is { campo: string; kg: number; count: number; inversion: number } => Boolean(r))
      .sort((a, b) => b.kg - a.kg);
  }, [filtradas, campos]);

  if (compras.length === 0) {
    return <EmptyModule label="compras" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compras"
        subtitle="Hacienda comprada — entrada al sistema con datos físicos y comerciales."
        count={{ value: filtradas.length, label: 'compras' }}
        lastDate={filtradas[0]?.fecha}
        actions={
          <ExportCsvButton
            onClick={() => exportCompras(filtradas, campos)}
            disabled={filtradas.length === 0}
            count={filtradas.length}
          />
        }
      />

      <SimpleFilterBar filtros={filtros} campos={campos} onChange={setFiltros} añosDisponibles={añosDisponibles} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Kpi
          label="Total compras"
          value={formatNumber(kpis.total)}
          accent="navy"
          icon={<ActivityIcon size={18} />}
        />
        <Kpi
          label="Cabezas aprox"
          value={kpis.cabezas > 0 ? formatNumber(kpis.cabezas) : '—'}
          sublabel="Suma de números en cant/cat"
          accent="orange"
          icon={<UsersIcon size={18} />}
        />
        <Kpi
          label="Kg totales"
          value={kpis.kgTotales > 0 ? formatNumber(kpis.kgTotales) : '—'}
          sublabel="Kg netos destino"
          accent="navy"
          icon={<ScaleIcon size={18} />}
        />
        <Kpi
          label="Inversión total"
          value={kpis.inversion > 0 ? `$${formatNumber(kpis.inversion)}` : '—'}
          sublabel="Σ (precio × kg destino)"
          accent="navy"
          icon={<CoinsIcon size={18} />}
        />
        <Kpi
          label="Merma promedio"
          value={kpis.mermaCount > 0 ? `${kpis.mermaPromedio.toFixed(2)} %` : '—'}
          sublabel={`Promedio sobre ${kpis.mermaCount} compras`}
          accent="terracota"
          icon={<PercentIcon size={18} />}
        />
      </div>

      {/* Chart row: por mes + por campo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Compras por mes" subtitle="Cantidad de operaciones registradas">
          {porMes.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-asfion-muted">
              Sin compras en el período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porMes} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
                <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="compras" name="Compras" fill="#163349" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="compras" position="top" fontSize={11} fill="#163349" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Kg por campo" subtitle="Total kg netos de destino acumulados">
          {porCampo.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-asfion-muted">
              Sin compras cargadas
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(260, porCampo.length * 36)}>
              <BarChart data={porCampo} layout="vertical" margin={{ top: 8, right: 80, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" horizontal={false} />
                <XAxis type="number" stroke="#6B7280" fontSize={12} />
                <YAxis type="category" dataKey="campo" stroke="#6B7280" fontSize={12} width={90} />
                <Tooltip formatter={(v: number) => [`${formatNumber(v)} kg`, 'Kg destino']} />
                <Bar dataKey="kg" radius={[0, 4, 4, 0]}>
                  {/* Orange brand (#FF8409) — coherente con "por campo" en
                      Lluvias / Mortandad / Pastoreo. Antes usaba un mostaza
                      #B8802E que no pertenecía a la paleta. */}
                  {porCampo.map((_, i) => (
                    <Cell key={i} fill="#FF8409" />
                  ))}
                  <LabelList
                    dataKey="kg"
                    position="right"
                    fontSize={11}
                    fill="#163349"
                    formatter={(v: number) => formatNumber(v)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Tabla detalle */}
      <Card
        title="Detalle de compras"
        subtitle="Hasta 50 más recientes — exportá el CSV para ver todo"
      >
        <DetalleTabla rows={filtradas.slice(0, 50)} campos={campos} />
      </Card>
    </div>
  );
}

// Tabla detalle paginada (50 filas) con todas las columnas del schema.
function DetalleTabla({ rows, campos }: { rows: Compra[]; campos: Campo[] }) {
  const campoNombre = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-asfion-muted italic py-4">
        Sin compras en el rango filtrado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-asfion-borderSoft text-xs uppercase tracking-wide text-asfion-muted">
            <th className="text-left font-semibold py-2 pr-3">N° Op.</th>
            <th className="text-left font-semibold py-2 pr-3">Fecha</th>
            <th className="text-left font-semibold py-2 pr-3">Campo</th>
            <th className="text-left font-semibold py-2 pr-3">Actividad</th>
            <th className="text-left font-semibold py-2 pr-3">Cant. / Cat.</th>
            <th className="text-right font-semibold py-2 pr-3">Kg origen</th>
            <th className="text-right font-semibold py-2 pr-3">Kg destino</th>
            <th className="text-right font-semibold py-2 pr-3">Merma</th>
            <th className="text-right font-semibold py-2 pr-3">Precio</th>
            <th className="text-left font-semibold py-2 pr-3">Titular</th>
            <th className="text-left font-semibold py-2">Plazo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-asfion-borderSoft/50">
              <td className="py-2 pr-3 font-semibold text-asfion-navy">{r.numeroOperacion ?? '—'}</td>
              <td className="py-2 pr-3 tabular-nums text-asfion-navy">{r.fecha}</td>
              <td className="py-2 pr-3 text-asfion-navy">{campoNombre(r.campoId)}</td>
              <td className="py-2 pr-3 text-asfion-muted">{r.actividad ?? '—'}</td>
              <td className="py-2 pr-3 text-asfion-muted">{r.cantCabYCat ?? '—'}</td>
              <td className="py-2 pr-3 tabular-nums text-right text-asfion-navy">
                {formatNumber(Math.round(r.kgNetosOrigen))}
              </td>
              <td className="py-2 pr-3 tabular-nums text-right text-asfion-navy">
                {formatNumber(Math.round(r.kgNetosDestino))}
              </td>
              <td className="py-2 pr-3 tabular-nums text-right text-asfion-muted">
                {r.mermaPorcentaje != null ? `${r.mermaPorcentaje.toFixed(1)}%` : '—'}
              </td>
              <td className="py-2 pr-3 tabular-nums text-right text-asfion-muted">
                {r.precio != null ? `$${formatNumber(r.precio)}` : '—'}
              </td>
              <td className="py-2 pr-3 text-asfion-muted max-w-[180px] truncate" title={r.titular ?? ''}>
                {r.titular ?? '—'}
              </td>
              <td className="py-2 text-asfion-muted">{r.plazo ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Export CSV de compras — todas las columnas del schema, lista para Excel.
function exportCompras(rows: Compra[], campos: Campo[]): void {
  const campoNombre = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;
  const cols: CsvColumn<Compra>[] = [
    { header: 'N° Operación',        value: r => r.numeroOperacion ?? '' },
    { header: 'Fecha',               value: r => r.fecha },
    { header: 'Campo',               value: r => campoNombre(r.campoId) },
    { header: 'Actividad',           value: r => r.actividad ?? '' },
    { header: 'Cantidad y categoría',value: r => r.cantCabYCat ?? '' },
    { header: 'Kg netos origen',     value: r => r.kgNetosOrigen },
    { header: 'Kg netos destino',    value: r => r.kgNetosDestino },
    { header: 'Merma %',             value: r => r.mermaPorcentaje ?? '' },
    { header: 'Kg corregidos',       value: r => r.kgCorregidos ?? '' },
    { header: 'Precio (ARS/kg)',     value: r => r.precio ?? '' },
    { header: 'Total estimado',      value: r => r.precio != null ? r.precio * r.kgNetosDestino : '' },
    { header: 'Consignado',          value: r => r.consignado ?? '' },
    { header: 'Titular',             value: r => r.titular ?? '' },
    { header: 'Plazo',               value: r => r.plazo ?? '' },
    { header: 'N° DTE',              value: r => r.numeroDte ?? '' },
    { header: 'Km recorrido',        value: r => r.kmRecorrido ?? '' },
    { header: 'Observaciones',       value: r => r.observaciones ?? '' },
    { header: 'Cargado por',         value: r => r.usuarioEmail },
    { header: 'Fecha de carga',      value: r => r.createdAt },
  ];
  const csv = rowsToCsv(rows, cols);
  downloadCsv(csv, csvFilename('compras'));
}

