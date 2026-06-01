// Página del módulo Pastoreo.
//
// Modelo "stay log": cada registro es una entrada a una parcela; cuando
// el animal sale, se setea fechaSalida. Un "stay abierto" es un registro
// con fechaSalida = null (el lote sigue ocupando la parcela).
//
// KPIs: total movimientos, stays abiertos, circuitos activos, parcelas en uso.
// Charts: por circuito (con # de abiertos resaltado), por categoría animal.

import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ActivityIcon,
  ClockIcon,
  LandPlotIcon,
  MapPinIcon,
  RouteIcon,
  ScaleIcon,
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
import { formatNumber } from '@/lib/utils';
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';
import type { Campo, Circuito, Pastoreo } from '@/data/types';

interface Props {
  pastoreo: Pastoreo[];
  campos: Campo[];
  circuitos: Circuito[];
}

export function PastoreoPage({ pastoreo, campos, circuitos }: Props) {
  const [filtros, setFiltros] = useState<SimpleFiltros>(SIMPLE_FILTROS_DEFAULT);

  // Mapa circuitoId → meta para resolver nombres y campo padre rápido.
  const circuitoMap = useMemo(
    () => new Map(circuitos.map(c => [c.id, c])),
    [circuitos],
  );

  const filtrados = useMemo(() => {
    const desde = rangoDesde(filtros.rango);
    return pastoreo.filter(p => {
      if (desde && p.fecha < desde) return false;
      if (filtros.campoId !== 'todos' && p.campoId !== filtros.campoId) return false;
      return true;
    });
  }, [pastoreo, filtros]);

  // ---------- KPIs ----------
  //
  // El Power BI del cliente tiene 5 KPIs en pastoreo:
  //   Animales · Has Circuito · KG/Cab · Kg Totales · Carga (kg/ha)
  //
  // Migration 0003 agregó animales + kg_promedio al schema, así que ya
  // podemos calcular los 5. Fórmulas (replican el DAX del cliente):
  //
  //   Animales    = SUM(animales) sobre stays con dato
  //   Kg Totales  = SUM(animales × kg_promedio) sobre stays con ambos datos
  //   KG/Cab      = AVG(kg_promedio) sobre stays con dato (no weighted —
  //                 así matchea el cálculo del Power BI: 309.64 vs el
  //                 weighted que daría 292.06 con los mismos números).
  //   Carga       = Kg Totales / Has Circuito (kg / ha)
  //   Has Circuito = SUM(hectareas) sobre circuitos con al menos un stay.
  //
  // Si un stay no tiene animales o kg_promedio cargados (stays viejos
  // previos a migration 0003), se ignora en esos KPIs — el peón que cargue
  // datos productivos completos los va a ver reflejados.
  const kpis = useMemo(() => {
    const abiertos = filtrados.filter(p => !p.fechaSalida).length;
    const cerrados = filtrados.length - abiertos;
    const parcelas = new Set<string>();
    const circuitosUsados = new Set<string>();
    filtrados.forEach(p => {
      if (!p.fechaSalida) parcelas.add(p.parcelaId);
      circuitosUsados.add(p.circuitoId);
    });
    let hectareas = 0;
    circuitosUsados.forEach(id => {
      const c = circuitoMap.get(id);
      if (c?.hectareas) hectareas += c.hectareas;
    });
    // KPIs productivos (migration 0003)
    let animalesTotal = 0;
    let kgTotales = 0;
    let sumKgPromedio = 0;
    let nConKg = 0;
    filtrados.forEach(p => {
      if (p.animales != null) animalesTotal += p.animales;
      if (p.kgPromedio != null) {
        sumKgPromedio += p.kgPromedio;
        nConKg++;
      }
      if (p.animales != null && p.kgPromedio != null) {
        kgTotales += p.animales * p.kgPromedio;
      }
    });
    const kgPorCab = nConKg > 0 ? sumKgPromedio / nConKg : 0;
    const carga    = hectareas > 0 ? kgTotales / hectareas : 0;
    // Días promedio de stay (solo cerrados)
    let totalDias = 0;
    let nCerrados = 0;
    filtrados.forEach(p => {
      if (!p.fechaSalida) return;
      const ent = Date.parse(p.fecha);
      const sal = Date.parse(p.fechaSalida);
      if (Number.isFinite(ent) && Number.isFinite(sal) && sal >= ent) {
        totalDias += (sal - ent) / (1000 * 60 * 60 * 24);
        nCerrados++;
      }
    });
    const diasProm = nCerrados > 0 ? totalDias / nCerrados : 0;

    return {
      total: filtrados.length,
      abiertos,
      cerrados,
      parcelasEnUso: parcelas.size,
      circuitosActivos: circuitosUsados.size,
      hectareas,
      animalesTotal,
      kgTotales,
      kgPorCab,
      carga,
      nConKg,
      diasProm,
    };
  }, [filtrados, circuitoMap]);

  // Kg Totales por categoría — para el chart estilo Power BI.
  const kgPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    filtrados.forEach(p => {
      if (p.animales == null || p.kgPromedio == null) return;
      const cat = p.categoria || 'Sin categoría';
      map.set(cat, (map.get(cat) ?? 0) + p.animales * p.kgPromedio);
    });
    return [...map.entries()]
      .map(([categoria, kg]) => ({ categoria, kg: Math.round(kg) }))
      .sort((a, b) => b.kg - a.kg);
  }, [filtrados]);

  // ---------- Por circuito (top 12) ----------
  const porCircuito = useMemo(() => {
    const map = new Map<string, { circuito: string; campo: string; total: number; abiertos: number }>();
    filtrados.forEach(p => {
      const cir = circuitoMap.get(p.circuitoId);
      const campoNombre = cir
        ? (campos.find(c => c.id === cir.campoId)?.nombre ?? '')
        : '';
      const entry = map.get(p.circuitoId) ?? {
        circuito: cir?.nombre ?? p.circuitoId,
        campo: campoNombre,
        total: 0,
        abiertos: 0,
      };
      entry.total++;
      if (!p.fechaSalida) entry.abiertos++;
      map.set(p.circuitoId, entry);
    });
    return [...map.values()]
      .map(e => ({ ...e, label: e.campo ? `${e.circuito} (${e.campo})` : e.circuito }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [filtrados, circuitoMap, campos]);

  // ---------- Por categoría animal ----------
  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    filtrados.forEach(p => {
      const cat = p.categoria || 'Sin categoría';
      map.set(cat, (map.get(cat) ?? 0) + 1);
    });
    return [...map.entries()]
      .map(([categoria, n]) => ({ categoria, n }))
      .sort((a, b) => b.n - a.n);
  }, [filtrados]);

  if (pastoreo.length === 0) {
    return <EmptyModule label="movimientos de pastoreo" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-asfion-deep">Pastoreo</h2>
          <p className="text-sm text-asfion-muted mt-1">
            Movimientos de animales entre parcelas — entrada, salida y ocupación actual.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-asfion-muted">
            <span className="font-semibold text-asfion-dark">{formatNumber(filtrados.length)}</span> movimientos
            <span className="mx-2">·</span>
            últimos datos: <span className="tabular-nums text-asfion-dark">{filtrados[0]?.fecha ?? '—'}</span>
          </div>
          <ExportCsvButton
            onClick={() => exportPastoreo(filtrados, campos, circuitos)}
            disabled={filtrados.length === 0}
            count={filtrados.length}
          />
        </div>
      </div>

      <SimpleFilterBar filtros={filtros} campos={campos} onChange={setFiltros} />

      {/* KPIs productivos — fila Power BI estilo */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Kpi
          label="Animales"
          value={kpis.animalesTotal > 0 ? formatNumber(kpis.animalesTotal) : '—'}
          sublabel="Cabezas en movimientos"
          accent="lime"
          icon={<UsersIcon size={18} />}
        />
        <Kpi
          label="Has Circuito"
          value={kpis.hectareas > 0 ? formatNumber(kpis.hectareas) : '—'}
          sublabel="Hectáreas activas"
          accent="dark"
          icon={<LandPlotIcon size={18} />}
        />
        <Kpi
          label="KG/Cab"
          value={kpis.kgPorCab > 0 ? kpis.kgPorCab.toFixed(2) : '—'}
          sublabel={`Prom. en ${formatNumber(kpis.nConKg)} stays`}
          accent="dark"
          icon={<ScaleIcon size={18} />}
        />
        <Kpi
          label="Kg Totales"
          value={kpis.kgTotales > 0 ? formatNumber(Math.round(kpis.kgTotales)) : '—'}
          sublabel="Σ (animales × kg/cab)"
          accent="dark"
          icon={<WeightIcon size={18} />}
        />
        <Kpi
          label="Carga (kg/ha)"
          value={kpis.carga > 0 ? kpis.carga.toFixed(2) : '—'}
          sublabel="Kg Totales / Has"
          accent="terracota"
          icon={<LandPlotIcon size={18} />}
        />
      </div>

      {/* KPIs operativos — fila secundaria */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label="Total movimientos"
          value={formatNumber(kpis.total)}
          sublabel={`${formatNumber(kpis.cerrados)} cerrados`}
          accent="dark"
          icon={<ActivityIcon size={18} />}
        />
        <Kpi
          label="Stays abiertos"
          value={formatNumber(kpis.abiertos)}
          sublabel={`${formatNumber(kpis.parcelasEnUso)} parcelas en uso`}
          accent="lime"
          icon={<MapPinIcon size={18} />}
        />
        <Kpi
          label="Circuitos activos"
          value={formatNumber(kpis.circuitosActivos)}
          accent="dark"
          icon={<RouteIcon size={18} />}
        />
        <Kpi
          label="Días prom. / stay"
          value={kpis.diasProm > 0 ? kpis.diasProm.toFixed(1) : '—'}
          sublabel="Solo stays cerrados"
          accent="terracota"
          icon={<ClockIcon size={18} />}
        />
      </div>

      <Card
        title="Animales por Campo y Circuito"
        subtitle="Top 12 — total movimientos · barras con cuántos siguen abiertos"
      >
        <ResponsiveContainer width="100%" height={Math.max(300, porCircuito.length * 32)}>
          <BarChart data={porCircuito} layout="vertical" margin={{ top: 8, right: 60, left: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E0" horizontal={false} />
            <XAxis type="number" stroke="#6B7280" fontSize={12} allowDecimals={false} />
            <YAxis type="category" dataKey="label" stroke="#6B7280" fontSize={11} width={180} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
            <Bar dataKey="total" name="Movimientos" fill="#1B4332" radius={[0, 0, 0, 0]}>
              <LabelList dataKey="total" position="right" fontSize={11} fill="#1B4332" />
            </Bar>
            <Bar dataKey="abiertos" name="Abiertos" fill="#52B788" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Por categoría animal" subtitle="Animales que más se rotan">
        <ResponsiveContainer width="100%" height={Math.max(280, porCategoria.length * 32)}>
          <BarChart data={porCategoria} layout="vertical" margin={{ top: 8, right: 60, left: 30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E0" horizontal={false} />
            <XAxis type="number" stroke="#6B7280" fontSize={12} allowDecimals={false} />
            <YAxis type="category" dataKey="categoria" stroke="#6B7280" fontSize={11} width={140} />
            <Tooltip />
            <Bar dataKey="n" radius={[0, 4, 4, 0]}>
              {porCategoria.map((_, i) => <Cell key={i} fill="#52B788" />)}
              <LabelList dataKey="n" position="right" fontSize={11} fill="#1B4332" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Kg Totales por Categoría — uno de los charts del Power BI del
          cliente. Solo aparece si hay stays con animales+kg cargados,
          sino daría todo 0. */}
      {kgPorCategoria.length > 0 && (
        <Card
          title="Kg Totales por Categoría"
          subtitle="Producción total = animales × kg/cab, agregado por categoría"
        >
          <ResponsiveContainer width="100%" height={Math.max(300, kgPorCategoria.length * 36)}>
            <BarChart data={kgPorCategoria} margin={{ top: 24, right: 8, left: 8, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E0" vertical={false} />
              <XAxis dataKey="categoria" stroke="#6B7280" fontSize={11} angle={-15} textAnchor="end" height={60} interval={0} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip formatter={(v: number) => [`${formatNumber(v)} kg`, 'Total']} />
              <Bar dataKey="kg" name="Kg Totales" fill="#1B4332" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="kg" position="top" fontSize={11} fill="#1B4332" formatter={(v: number) => formatNumber(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Tabla detalle — replica el "Campo / Fecha Entrada / Circuito / Has /
          Kg Promedio / Animales" del Power BI. Kg Promedio y Animales no
          existen en el schema actual, así que mostramos categoría y caravana
          en su lugar. Cuando el cliente agregue esos campos al INSERT,
          basta cambiar 2 columnas y se replica 1:1. */}
      <Card title="Detalle de movimientos" subtitle="Últimos 50 — ordenados por fecha de entrada">
        <DetalleTabla rows={filtrados.slice(0, 50)} campos={campos} circuitos={circuitos} />
      </Card>
    </div>
  );
}

// Tabla de detalle de pastoreo — vista plana al estilo Power BI.
// Antes mostrábamos esta info SOLO en el CSV exportado; ahora también
// inline para ver de un vistazo / hacer screenshots.
function DetalleTabla({
  rows, campos, circuitos,
}: {
  rows: Pastoreo[];
  campos: Campo[];
  circuitos: Circuito[];
}) {
  const campoNombre = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;
  const circuitoNombre = (id: string) => circuitos.find(c => c.id === id)?.nombre ?? id;
  const circuitoHas = (id: string) => circuitos.find(c => c.id === id)?.hectareas;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-asfion-muted italic py-4">
        Sin movimientos en el rango filtrado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-asfion-borderSoft text-xs uppercase tracking-wide text-asfion-muted">
            <th className="text-left font-semibold py-2 pr-3">Campo</th>
            <th className="text-left font-semibold py-2 pr-3">Fecha entrada</th>
            <th className="text-left font-semibold py-2 pr-3">Salida</th>
            <th className="text-left font-semibold py-2 pr-3">Circuito</th>
            <th className="text-right font-semibold py-2 pr-3">Has</th>
            <th className="text-left font-semibold py-2 pr-3">Categoría</th>
            <th className="text-left font-semibold py-2 pr-3">Caravana</th>
            <th className="text-left font-semibold py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-asfion-borderSoft/50">
              <td className="py-2 pr-3 font-semibold text-asfion-dark">{campoNombre(r.campoId)}</td>
              <td className="py-2 pr-3 tabular-nums text-asfion-dark">{r.fecha}</td>
              <td className="py-2 pr-3 tabular-nums text-asfion-muted">{r.fechaSalida ?? '—'}</td>
              <td className="py-2 pr-3 text-asfion-dark">{circuitoNombre(r.circuitoId)}</td>
              <td className="py-2 pr-3 tabular-nums text-right text-asfion-muted">
                {circuitoHas(r.circuitoId)?.toFixed(0) ?? '—'}
              </td>
              <td className="py-2 pr-3 text-asfion-dark">{r.categoria}</td>
              <td className="py-2 pr-3 text-asfion-muted">{r.caravanaNumero ?? '—'}</td>
              <td className="py-2">
                {r.fechaSalida ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-asfion-borderSoft text-asfion-muted">
                    Cerrado
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-asfion-lime/20 text-asfion-dark">
                    Abierto
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Export CSV de pastoreo — una fila por movimiento (stay).
// Calculamos días de stay si está cerrado, para que el cliente pueda
// hacer pivots en Excel sobre "duración promedio por categoría", etc.
function exportPastoreo(rows: Pastoreo[], campos: Campo[], circuitos: Circuito[]): void {
  const campoNombre = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;
  const circuitoNombre = (id: string) => circuitos.find(c => c.id === id)?.nombre ?? id;
  const diasStay = (r: Pastoreo): string => {
    if (!r.fechaSalida) return '';
    const ent = Date.parse(r.fecha);
    const sal = Date.parse(r.fechaSalida);
    if (!Number.isFinite(ent) || !Number.isFinite(sal)) return '';
    return String(Math.max(0, Math.round((sal - ent) / (1000 * 60 * 60 * 24))));
  };
  const cols: CsvColumn<Pastoreo>[] = [
    { header: 'Fecha entrada',  value: r => r.fecha },
    { header: 'Fecha salida',   value: r => r.fechaSalida ?? '' },
    { header: 'Días de stay',   value: r => diasStay(r) },
    { header: 'Estado',         value: r => r.fechaSalida ? 'Cerrado' : 'Abierto' },
    { header: 'Campo',          value: r => campoNombre(r.campoId) },
    { header: 'Circuito',       value: r => circuitoNombre(r.circuitoId) },
    { header: 'Parcela',        value: r => r.parcelaNumero != null ? String(r.parcelaNumero) : r.parcelaId },
    { header: 'Categoría',      value: r => r.categoria },
    { header: 'Categoría animal', value: r => r.categoriaAnimal ?? '' },
    { header: 'Evento',         value: r => r.evento ?? '' },
    { header: 'Animales',       value: r => r.animales ?? '' },
    { header: 'Kg promedio',    value: r => r.kgPromedio ?? '' },
    { header: 'Kg totales',     value: r => (r.animales != null && r.kgPromedio != null) ? r.animales * r.kgPromedio : '' },
    { header: 'Caravana número',value: r => r.caravanaNumero ?? '' },
    { header: 'Causa',          value: r => r.causa ?? '' },
    { header: 'Cargado por',    value: r => r.usuarioEmail },
    { header: 'Fecha de carga', value: r => r.createdAt },
  ];
  const csv = rowsToCsv(rows, cols);
  downloadCsv(csv, csvFilename('pastoreo'));
}

function EmptyModule({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-asfion-borderSoft bg-white px-6 py-10 text-center">
      <p className="text-asfion-dark font-semibold">Todavía no hay {label} cargados.</p>
      <p className="text-sm text-asfion-muted mt-1">
        En cuanto los operarios carguen eventos desde la app, los vas a ver acá.
      </p>
    </div>
  );
}
