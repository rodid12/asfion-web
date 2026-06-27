// =============================================================================
// ResumenServicioTable — Resumen Mermas Servicio anual por tropa
// =============================================================================
//
// Renderea la Hoja 3 del Excel del cliente: 1 fila por tropa con
// preñadas / mortandad de vientres / terneros nacidos / terneros vivos /
// % destete. La columna "Terneros Vivos" sale destacada en verde porque
// el cliente fue explícito: "la columna de terneros vivos que estan en
// verde es la mas importante".
//
// También fix "HAY QUE CORREGIR MUERTES" del Excel: la columna
// "Mortandad" ahora es MORTANDAD DE VIENTRES durante servicio (no
// muertes de terneros, que tienen su propia columna).

import React, { useMemo } from 'react';
import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import { formatNumber, formatPercent } from '@/lib/utils';
import { kpiValueClass, KPI_VALUE_BASE, kpiTitleAttr } from '@/lib/kpiSize';
import type { ResumenServicio } from '@/data/types';

interface Props {
  rows: ResumenServicio[];
}

export function ResumenServicioTable({ rows }: Props) {
  // Año más reciente — si Agus carga 2025 mañana, mostramos ese por default.
  // Filtros futuros podrían venir del padre; por ahora UI mínima.
  const ultimoAnio = useMemo(
    () => Math.max(...rows.map(r => r.servicioAnio)),
    [rows],
  );
  const filas = useMemo(
    () => rows.filter(r => r.servicioAnio === ultimoAnio)
              .sort((a, b) => (a.campo + a.tropa).localeCompare(b.campo + b.tropa)),
    [rows, ultimoAnio],
  );

  // Totales — la fila de TOTALES del Excel.
  const totales = useMemo(() => {
    const sum = (xs: (number | undefined)[]) =>
      xs.reduce<number>((s, x) => s + (x ?? 0), 0);
    const prenadas        = sum(filas.map(r => r.prenadas));
    const mortandadVientres = sum(filas.map(r => r.mortandadVientres));
    const nptAbortos      = sum(filas.map(r => r.nptAbortosRetacto));
    const ternerosNacidos = sum(filas.map(r => r.ternerosNacidos));
    const ternerosVivos   = sum(filas.map(r => r.ternerosVivos));
    return {
      prenadas,
      mortandadVientres,
      nptAbortos,
      ternerosNacidos,
      ternerosVivos,
      pctDestete: prenadas > 0 ? ternerosVivos / prenadas : 0,
      pctMortVientres: prenadas > 0 ? mortandadVientres / prenadas : 0,
      pctMerma: ternerosNacidos > 0 ? (ternerosNacidos - ternerosVivos) / ternerosNacidos : 0,
    };
  }, [filas]);

  return (
    <Card
      title={`Resumen Mermas Servicio ${ultimoAnio}`}
      subtitle="Cierre anual por tropa — terneros vivos es la métrica clave"
    >
      {/* KPIs agregados arriba — totales sobre todas las tropas del año */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi
          label="Preñadas"
          value={formatNumber(totales.prenadas)}
          accent="navy"
          sublabel={`${filas.length} tropas`}
        />
        <Kpi
          label="Mortandad vientres"
          value={formatNumber(totales.mortandadVientres)}
          accent="terracota"
          sublabel={`${formatPercent(totales.pctMortVientres)} del servicio`}
        />
        <Kpi
          label="Terneros nacidos"
          value={formatNumber(totales.ternerosNacidos)}
          accent="navy"
        />
        {/* Verde explícito — métrica clave según el cliente.
            Usa kpiValueClass adaptivo como el resto de los tiles del
            dashboard, así si el número de terneros vivos crece a 5 dígitos
            o más, se reduce gracefully sin partir en 2 líneas. */}
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 shadow-card p-4 sm:p-5 flex flex-col gap-2 min-w-0 overflow-hidden">
          <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-emerald-700 truncate">
            Terneros vivos
          </p>
          <p
            className={`${kpiValueClass(formatNumber(totales.ternerosVivos), 'kpi')} ${KPI_VALUE_BASE} text-emerald-700`}
            title={kpiTitleAttr(formatNumber(totales.ternerosVivos))}
          >
            {formatNumber(totales.ternerosVivos)}
          </p>
          <p className="text-asfion-muted text-[11px] sm:text-xs">
            {formatPercent(totales.pctDestete)} destete sobre preñado
          </p>
        </div>
      </div>

      {/* Tabla de detalle por tropa */}
      <div className="overflow-x-auto -mx-2">
        <table className="min-w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-asfion-muted bg-asfion-borderSoft/40">
            <tr>
              <th className="text-left px-3 py-2">Campo</th>
              <th className="text-left px-3 py-2">Tropa</th>
              <th className="text-right px-3 py-2">Preñadas</th>
              <th className="text-right px-3 py-2" title="Vientres muertos durante servicio">
                Mort. vientres
              </th>
              <th className="text-right px-3 py-2">NPT / Abortos</th>
              <th className="text-right px-3 py-2">Nacidos</th>
              <th className="text-right px-3 py-2 bg-emerald-100 text-emerald-800">
                Terneros vivos
              </th>
              <th className="text-right px-3 py-2 bg-emerald-100 text-emerald-800">% Destete</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(r => (
              <tr key={r.id} className="border-t border-asfion-borderSoft/60 hover:bg-asfion-orangeSoft/15">
                <td className="px-3 py-2 font-medium">{r.campo}</td>
                <td className="px-3 py-2 text-xs">{r.tropa}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.prenadas ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-asfion-terracota">
                  {formatNumber(r.mortandadVientres ?? 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-asfion-muted">
                  {formatNumber(r.nptAbortosRetacto ?? 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.ternerosNacidos ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-bold bg-emerald-50 text-emerald-700">
                  {formatNumber(r.ternerosVivos ?? 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold bg-emerald-50 text-emerald-700">
                  {r.pctDesteteSobrePrenado != null ? formatPercent(r.pctDesteteSobrePrenado) : '—'}
                </td>
              </tr>
            ))}
            {/* Fila de totales */}
            <tr className="border-t-2 border-asfion-borderSoft font-bold bg-asfion-navy/5">
              <td className="px-3 py-2" colSpan={2}>TOTAL</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totales.prenadas)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-asfion-terracota">
                {formatNumber(totales.mortandadVientres)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totales.nptAbortos)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totales.ternerosNacidos)}</td>
              <td className="px-3 py-2 text-right tabular-nums bg-emerald-100 text-emerald-800">
                {formatNumber(totales.ternerosVivos)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums bg-emerald-100 text-emerald-800">
                {formatPercent(totales.pctDestete)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-asfion-muted mt-3">
        <strong>Mortandad vientres</strong> = vacas muertas durante el servicio
        (corregido vs versión anterior que confundía con muertes de terneros).
        <span className="ml-2">
          <strong>Terneros vivos</strong> = nacidos − muertes (señalado + sin
          señalar) — es el número que determina el % destete real.
        </span>
      </p>
    </Card>
  );
}
