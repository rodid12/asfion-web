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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ActivityIcon,
  ClockIcon,
  MapPinIcon,
  RouteIcon,
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
  const kpis = useMemo(() => {
    const abiertos = filtrados.filter(p => !p.fechaSalida).length;
    const cerrados = filtrados.length - abiertos;
    const parcelas = new Set<string>();
    const circuitosUsados = new Set<string>();
    filtrados.forEach(p => {
      if (!p.fechaSalida) parcelas.add(p.parcelaId);
      circuitosUsados.add(p.circuitoId);
    });
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
      diasProm,
    };
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          label="Días promedio / stay"
          value={kpis.diasProm > 0 ? kpis.diasProm.toFixed(1) : '—'}
          sublabel="Solo stays cerrados"
          accent="terracota"
          icon={<ClockIcon size={18} />}
        />
      </div>

      <Card
        title="Por circuito"
        subtitle="Top 12 — total movimientos + cuántos siguen abiertos"
      >
        <ResponsiveContainer width="100%" height={Math.max(280, porCircuito.length * 28)}>
          <BarChart data={porCircuito} layout="vertical" margin={{ top: 8, right: 16, left: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E0" horizontal={false} />
            <XAxis type="number" stroke="#6B7280" fontSize={12} allowDecimals={false} />
            <YAxis type="category" dataKey="label" stroke="#6B7280" fontSize={11} width={180} />
            <Tooltip />
            <Bar dataKey="total" name="Movimientos" fill="#1B4332" radius={[0, 0, 0, 0]} />
            <Bar dataKey="abiertos" name="Abiertos" fill="#52B788" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Por categoría animal" subtitle="Animales que más se rotan">
        <ResponsiveContainer width="100%" height={Math.max(280, porCategoria.length * 28)}>
          <BarChart data={porCategoria} layout="vertical" margin={{ top: 8, right: 16, left: 30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E0" horizontal={false} />
            <XAxis type="number" stroke="#6B7280" fontSize={12} allowDecimals={false} />
            <YAxis type="category" dataKey="categoria" stroke="#6B7280" fontSize={11} width={140} />
            <Tooltip />
            <Bar dataKey="n" radius={[0, 4, 4, 0]}>
              {porCategoria.map((_, i) => <Cell key={i} fill="#52B788" />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
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
