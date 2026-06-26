// Página del módulo NDVI / Materia Seca — réplica de la página 4 del
// Power BI de Agus ("NDVI").
//
// El NDVI (Normalized Difference Vegetation Index) es un índice satelital
// que mide vigor de la vegetación. De ahí se deriva la estimación de
// Materia Seca (MS) disponible por parcela — el "stock" de pasto que el
// productor tiene para que coman los animales.
//
// Métricas que replicamos:
//   - MS kg/ha Promedio   = promedio de productividad de la pastura
//   - MS Total            = SUM(MS kg/ha × Has parcela) → kg disponibles
//   - Ha NDVI             = Has bajo medición satelital
//   - Materia Seca por Circuito → bar chart agregado
//   - Evolución temporal MS Total vs Consumo MS (kg) → area chart
//   - Tabla detallada: Circuito · Parcelas · MS Total · Has · Consumo MS · MS Remanente
//
// Fuente: hoy NO está cargada. Las opciones típicas son:
//   (a) Sync con plataforma satelital (Auravant, CropMonitoring, Sentinel)
//   (b) Carga manual desde Excel del ingeniero agrónomo
//   (c) Cálculo derivado del Pastoreo (estimación grosera, no precisa)
//
// Por ahora la página renderiza empty state hasta que enchufemos una
// fuente. Cuando llega data poblada via prop `mediciones`, todo se calcula
// automático.

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
import { LeafIcon, MapPinIcon, ScaleIcon, SatelliteIcon } from 'lucide-react';
import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import { PageHeader } from '@/components/PageHeader';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import {
  enPeriodo,
  añosEnData,
  type SimpleFiltros,
} from '@/components/SimpleFilterBar';
import { cn, formatNumber } from '@/lib/utils';

/**
 * Shape de una medición NDVI/MS por parcela.
 *
 * Estructura tomada del modelo del Power BI (`NDVI_Pasturas` table). Una
 * fila = un snapshot de una parcela en una fecha dada. Si el productor
 * mide la misma parcela varias veces, hay varias filas (las agregamos).
 *
 * Cuando se enchufe la fuente real, exportar esta interfaz desde
 * data/types.ts y reemplazar en la prop.
 */
export interface MedicionNdvi {
  id: string;
  fecha: string;            // YYYY-MM-DD del paso del satélite o medición
  campo: string;
  circuito: string;
  parcela: string;
  hasParcela: number;       // hectáreas de la parcela
  msKgPorHa: number;        // kg MS / ha (productividad estimada)
  consumoMsKg?: number;     // consumo derivado de Pastoreo en ese período
}

interface Props {
  /** Mediciones NDVI cargadas. Por ahora siempre vacío; cuando enchufemos
   *  la fuente (Auravant, planilla del agrónomo o sync satelital propio),
   *  se llena desde el server. */
  mediciones?: MedicionNdvi[];
  /** Campos para alimentar el slicer de filtro (mismo que otras páginas). */
  campos?: string[];
}

export function NdviPage({ mediciones = [], campos = [] }: Props) {
  const [campo, setCampo] = useState<string>('todos');
  const [filtrosPeriodo, setFiltrosPeriodo] = useState<SimpleFiltros>({
    rango: '12m',
    campoId: 'todos',  // no se usa acá
  });

  const añosDisponibles = useMemo(
    () => añosEnData(mediciones.map(m => m.fecha)),
    [mediciones],
  );

  const filtrados = useMemo(() => {
    return mediciones.filter(m => {
      if (campo !== 'todos' && m.campo.toUpperCase() !== campo.toUpperCase()) return false;
      if (m.fecha && !enPeriodo(m.fecha, filtrosPeriodo)) return false;
      return true;
    });
  }, [mediciones, campo, filtrosPeriodo]);

  // KPIs principales — réplica del Power BI página 4
  const kpis = useMemo(() => {
    if (filtrados.length === 0) {
      return { msKgHaProm: 0, msTotal: 0, haNdvi: 0, consumoTotal: 0, remanente: 0 };
    }
    let sumMS = 0;     // SUM(msKgPorHa × hasParcela) = MS Total
    let sumHas = 0;    // SUM(hasParcela)
    let sumConsumo = 0;
    filtrados.forEach(m => {
      sumMS  += (m.msKgPorHa || 0) * (m.hasParcela || 0);
      sumHas += (m.hasParcela || 0);
      sumConsumo += m.consumoMsKg ?? 0;
    });
    const msKgHaProm = sumHas > 0 ? sumMS / sumHas : 0;
    return {
      msKgHaProm,
      msTotal: sumMS,
      haNdvi: sumHas,
      consumoTotal: sumConsumo,
      remanente: Math.max(0, sumMS - sumConsumo),
    };
  }, [filtrados]);

  // Bar chart: MS Total por Circuito
  const porCircuito = useMemo(() => {
    const map = new Map<string, { msTotal: number; has: number; consumo: number }>();
    filtrados.forEach(m => {
      const key = m.circuito || '—';
      const cur = map.get(key) ?? { msTotal: 0, has: 0, consumo: 0 };
      cur.msTotal += (m.msKgPorHa || 0) * (m.hasParcela || 0);
      cur.has     += (m.hasParcela || 0);
      cur.consumo += m.consumoMsKg ?? 0;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([circuito, v]) => ({
        circuito,
        msTotal: Math.round(v.msTotal),
        has: v.has,
        consumo: Math.round(v.consumo),
        remanente: Math.round(Math.max(0, v.msTotal - v.consumo)),
      }))
      .sort((a, b) => b.msTotal - a.msTotal);
  }, [filtrados]);

  // Area chart: evolución temporal MS Total vs Consumo MS
  const porMes = useMemo(() => {
    const map = new Map<string, { ms: number; consumo: number }>();
    filtrados.forEach(m => {
      const key = (m.fecha ?? '').slice(0, 7);
      if (!key) return;
      const cur = map.get(key) ?? { ms: 0, consumo: 0 };
      cur.ms      += (m.msKgPorHa || 0) * (m.hasParcela || 0);
      cur.consumo += m.consumoMsKg ?? 0;
      map.set(key, cur);
    });
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, v]) => {
        const [y, mo] = key.split('-');
        const idx = Math.max(0, Math.min(11, parseInt(mo ?? '1', 10) - 1));
        return {
          key,
          mes: `${MESES[idx]} ${(y ?? '').slice(2)}`,
          ms: Math.round(v.ms),
          consumo: Math.round(v.consumo),
        };
      });
  }, [filtrados]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="NDVI / Materia Seca"
        subtitle="Productividad de pasturas según índice satelital — MS disponible, consumo y remanente por circuito."
        count={{ value: filtrados.length, label: 'mediciones' }}
        actions={
          <ExportCsvButton
            onClick={() => {/* TODO cuando llegue la data */}}
            disabled={filtrados.length === 0}
            count={filtrados.length}
          />
        }
      />

      {/* Filtros — rango + año + campo. Mismo patrón que el resto del dashboard. */}
      <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-center gap-3">
        <div className={cn('flex items-center gap-1 flex-wrap', filtrosPeriodo.año != null && 'opacity-40')}>
          <span className="text-xs uppercase font-semibold text-asfion-muted mr-2">Rango</span>
          {([['7d', '7d'], ['30d', '30d'], ['90d', '90d'], ['12m', '12m'], ['todo', 'Todo']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFiltrosPeriodo({ ...filtrosPeriodo, rango: val, año: undefined })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-semibold transition',
                filtrosPeriodo.rango === val && filtrosPeriodo.año == null
                  ? 'bg-asfion-navy text-white'
                  : 'bg-asfion-bg text-asfion-navy hover:bg-asfion-orangeSoft/25',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-8 w-px bg-asfion-borderSoft" />
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-asfion-muted">Año</span>
          <select
            value={filtrosPeriodo.año ?? ''}
            onChange={e => {
              const v = e.target.value;
              setFiltrosPeriodo({ ...filtrosPeriodo, año: v === '' ? undefined : parseInt(v, 10) });
            }}
            className="bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition cursor-pointer"
          >
            <option value="">— Por rango —</option>
            {(añosDisponibles.length > 0 ? añosDisponibles : [new Date().getFullYear()]).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="h-8 w-px bg-asfion-borderSoft" />
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-asfion-muted">Campo</span>
          <select
            value={campo}
            onChange={e => setCampo(e.target.value)}
            className="bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition cursor-pointer"
          >
            <option value="todos">Todos</option>
            {campos.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {mediciones.length === 0 ? (
        <Card title="Sin datos de NDVI cargados" subtitle="La fuente satelital todavía no está conectada">
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-asfion-orangeSoft flex items-center justify-center">
              <SatelliteIcon size={28} className="text-asfion-navyDeep" />
            </div>
            <p className="text-sm font-semibold text-asfion-navy">
              Todavía no hay mediciones NDVI cargadas.
            </p>
            <p className="text-xs text-asfion-muted max-w-md">
              Cuando se enchufe la fuente (sync con plataforma satelital como
              Auravant o Sentinel, planilla del ingeniero agrónomo, o cálculo
              derivado del Pastoreo), acá vas a ver: MS kg/ha Promedio · MS
              Total · Ha NDVI · evolución temporal MS vs Consumo · tabla
              detallada por circuito con MS Remanente. Réplica de la página
              "NDVI" del Power BI.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-[10px] uppercase text-asfion-muted">
              <div className="bg-asfion-bg px-3 py-2 rounded-lg border border-asfion-borderSoft">
                <p className="font-bold text-asfion-navyDeep">MS kg/ha</p>
                <p>Productividad pastura</p>
              </div>
              <div className="bg-asfion-bg px-3 py-2 rounded-lg border border-asfion-borderSoft">
                <p className="font-bold text-asfion-navyDeep">Consumo MS</p>
                <p>Desde Pastoreo</p>
              </div>
              <div className="bg-asfion-bg px-3 py-2 rounded-lg border border-asfion-borderSoft">
                <p className="font-bold text-asfion-navyDeep">Remanente</p>
                <p>MS Total − Consumo</p>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Kpi
              label="MS kg/ha Promedio"
              value={formatNumber(Math.round(kpis.msKgHaProm))}
              sublabel="Productividad estimada por hectárea"
              accent="orange"
              icon={<LeafIcon size={18} />}
            />
            <Kpi
              label="MS Total"
              value={formatNumber(Math.round(kpis.msTotal))}
              sublabel="kg disponibles en parcelas medidas"
              accent="navy"
              icon={<ScaleIcon size={18} />}
            />
            <Kpi
              label="Ha NDVI"
              value={formatNumber(Math.round(kpis.haNdvi))}
              sublabel="Hectáreas bajo medición"
              accent="navy"
              icon={<MapPinIcon size={18} />}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card
              title="Materia Seca por Circuito"
              subtitle="MS Total disponible — ranking de productividad"
              className="lg:col-span-2"
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={porCircuito} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
                  <XAxis dataKey="circuito" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip formatter={(v: number) => [formatNumber(v) + ' kg', 'MS Total']} />
                  <Bar dataKey="msTotal" fill="#FF8409" radius={[4, 4, 0, 0]}>
                    {porCircuito.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#FF8409' : '#FBC79A'} />
                    ))}
                    <LabelList dataKey="msTotal" position="top" fontSize={11} fill="#163349" formatter={(v: number) => formatNumber(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Evolución temporal" subtitle="MS Total vs Consumo MS">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={porMes} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
                  <XAxis dataKey="mes" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip formatter={(v: number) => formatNumber(v) + ' kg'} />
                  <Area type="monotone" dataKey="ms" name="MS Total" stroke="#163349" fill="#163349" fillOpacity={0.25} />
                  <Area type="monotone" dataKey="consumo" name="Consumo" stroke="#FF8409" fill="#FF8409" fillOpacity={0.35} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Tabla detallada */}
          <Card title="Detalle por circuito" subtitle="MS Total, Consumo y Remanente por agrupación">
            <DetalleTabla rows={porCircuito} />
          </Card>
        </>
      )}
    </div>
  );
}

// === Helpers internos ===

interface CircuitoRow {
  circuito: string;
  msTotal: number;
  has: number;
  consumo: number;
  remanente: number;
}

function DetalleTabla({ rows }: { rows: CircuitoRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-asfion-muted py-6 text-center">Sin circuitos para mostrar.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
            <th className="py-2 px-2 font-semibold">Circuito</th>
            <th className="py-2 px-2 font-semibold tabular-nums text-right">Has</th>
            <th className="py-2 px-2 font-semibold tabular-nums text-right">MS Total (kg)</th>
            <th className="py-2 px-2 font-semibold tabular-nums text-right">Consumo (kg)</th>
            <th className="py-2 px-2 font-semibold tabular-nums text-right">Remanente (kg)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.circuito} className="border-b border-asfion-borderSoft/50 last:border-0">
              <td className="py-2 px-2 font-semibold text-asfion-navy">{r.circuito}</td>
              <td className="py-2 px-2 text-right tabular-nums text-asfion-muted">{formatNumber(r.has)}</td>
              <td className="py-2 px-2 text-right tabular-nums text-asfion-navyDeep font-semibold">{formatNumber(r.msTotal)}</td>
              <td className="py-2 px-2 text-right tabular-nums text-asfion-muted">{formatNumber(r.consumo)}</td>
              <td className="py-2 px-2 text-right tabular-nums font-semibold text-asfion-orange">{formatNumber(r.remanente)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
