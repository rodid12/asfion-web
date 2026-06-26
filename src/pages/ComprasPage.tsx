// Página del módulo Compras — patrón master-detail tipo AppSheet.
//
// El cliente quería ver Compras como un libro de operaciones (no como un
// dashboard de métricas). Cada compra es una operación con número único
// (formato "10_26", "11_26"…) y un montón de campos: consignado, titular,
// fecha, cant cab y cat, KG netos origen/destino, merma %, km recorrido,
// número DTE, precio, plazo, observaciones.
//
// Layout:
//   - Header con filtros (rango / año / campo) — sigue igual
//   - 2 KPI rápidas arriba (total compras + inversión total) para escaneo
//   - Layout 2-cols:
//       Izquierda: lista agrupada por campo, ítems = número de operación
//                  con subtítulo "82 machos · 33 hembras"
//       Derecha:   panel con TODOS los campos de la operación seleccionada
//   - En mobile: lista full-width; click en un ítem → modal con detalle
//
// Mantenemos el export CSV con todos los campos del schema.

import React, { useMemo, useState } from 'react';
import { CoinsIcon, PackageIcon, XIcon, ChevronRightIcon } from 'lucide-react';
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
function parseCabezas(txt: string | undefined): number {
  if (!txt) return 0;
  const matches = txt.match(/\d+/g);
  if (!matches) return 0;
  return matches.reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0);
}

export function ComprasPage({ compras, campos }: Props) {
  const [filtros, setFiltros] = useState<SimpleFiltros>(SIMPLE_FILTROS_DEFAULT);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  // Filtros propios del módulo Compras (no van en SimpleFilterBar)
  const [consignado, setConsignado] = useState<string>('todos');
  const [busquedaOp, setBusquedaOp] = useState<string>('');

  const añosDisponibles = useMemo(
    () => añosEnData(compras.map(c => c.fecha)),
    [compras],
  );

  // Lista de consignados únicos del histórico, ordenados alfabéticamente.
  // Sirve para alimentar el dropdown de filtro de consignado.
  const consignadosUnicos = useMemo(() => {
    const set = new Set<string>();
    for (const c of compras) {
      if (c.consignado?.trim()) set.add(c.consignado.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [compras]);

  const filtradas = useMemo(() => {
    const busqueda = busquedaOp.trim().toLowerCase();
    return compras
      .filter(c => {
        if (!enPeriodo(c.fecha, filtros)) return false;
        if (filtros.campoId !== 'todos' && c.campoId !== filtros.campoId) return false;
        if (consignado !== 'todos' && c.consignado !== consignado) return false;
        if (busqueda) {
          const op = (c.numeroOperacion ?? '').toLowerCase();
          if (!op.includes(busqueda)) return false;
        }
        return true;
      })
      // Ordenamos desc por número de operación cuando hay (matchea el patrón
      // del cliente que numera secuencialmente "10_26", "11_26"…). Fallback
      // a fecha cuando no hay número.
      .sort((a, b) => {
        const aOp = a.numeroOperacion ?? '';
        const bOp = b.numeroOperacion ?? '';
        if (aOp && bOp) return bOp.localeCompare(aOp);
        return b.fecha.localeCompare(a.fecha);
      });
  }, [compras, filtros, consignado, busquedaOp]);

  // Agrupamos por campo para la lista — replica el patrón de AppSheet
  // que el cliente conoce. Si solo hay un campo, se ve igual.
  const agrupadas = useMemo(() => {
    const campoNombre = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;
    const groups = new Map<string, Compra[]>();
    filtradas.forEach(c => {
      const k = campoNombre(c.campoId);
      const arr = groups.get(k) ?? [];
      arr.push(c);
      groups.set(k, arr);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtradas, campos]);

  // Operación seleccionada — fallback a la primera del listado para que
  // siempre haya algo a la derecha cuando hay data.
  const seleccionada =
    filtradas.find(c => c.id === seleccionadaId) ?? filtradas[0] ?? null;

  // KPIs principales — replican los del Power BI / lista de pedidos.
  //
  //   - Cabezas totales con relación machos/hembras (usa columnas
  //     totalMachos/totalHembras del schema; si no están, parseamos el
  //     texto libre cantCabYCat como fallback).
  //   - Kg promedio por cabeza (kg destino / cabezas).
  //   - Inversión total = SUM(kg_netos_destino × precio). Es lo que
  //     "sacamos" en pesos para la operación.
  //   - Total de operaciones (count).
  const kpis = useMemo(() => {
    let cabezas = 0, machos = 0, hembras = 0;
    let kgNetos = 0, inversion = 0;
    let opsConDatos = 0;
    filtradas.forEach(c => {
      const tm = c.totalMachos ?? 0;
      const th = c.totalHembras ?? 0;
      // Si las columnas no están seteadas, fallback al parseo del texto.
      const cabezasOp = (tm > 0 || th > 0) ? (tm + th) : parseCabezas(c.cantCabYCat);
      cabezas += cabezasOp;
      machos += tm;
      hembras += th;
      const kg = Number.isFinite(c.kgNetosDestino) ? c.kgNetosDestino : 0;
      kgNetos += kg;
      if (c.precio != null && Number.isFinite(c.precio) && kg > 0) {
        inversion += kg * c.precio;
        opsConDatos++;
      }
    });
    const kgPromedio = cabezas > 0 ? kgNetos / cabezas : 0;
    return {
      totalOps: filtradas.length,
      cabezas, machos, hembras,
      kgNetos, kgPromedio,
      inversion, opsConDatos,
    };
  }, [filtradas]);

  if (compras.length === 0) {
    return <EmptyModule label="compras" />;
  }

  const campoNombre = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compras"
        subtitle="Operaciones de compra de hacienda — cada entrada al campo registrada por el administrador."
        count={{ value: filtradas.length, label: 'operaciones' }}
        lastDate={filtradas[0]?.fecha}
        actions={
          <ExportCsvButton
            onClick={() => exportCompras(filtradas, campos)}
            disabled={filtradas.length === 0}
            count={filtradas.length}
          />
        }
      />

      <SimpleFilterBar
        filtros={filtros}
        campos={campos}
        onChange={setFiltros}
        añosDisponibles={añosDisponibles}
      />

      {/* Filtros propios del módulo: consignado + búsqueda por nº operación.
          Quedan en una barra aparte porque conceptualmente son filtros del
          listado, no del período. */}
      <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-asfion-muted">Consignado</span>
          <select
            value={consignado}
            onChange={e => setConsignado(e.target.value)}
            className="bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition cursor-pointer"
          >
            <option value="todos">Todos</option>
            {consignadosUnicos.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="h-8 w-px bg-asfion-borderSoft" />

        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <span className="text-xs uppercase font-semibold text-asfion-muted">N° Operación</span>
          <input
            type="text"
            value={busquedaOp}
            onChange={e => setBusquedaOp(e.target.value)}
            placeholder="10_26, 11..."
            className="flex-1 max-w-[200px] bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy placeholder:text-asfion-muted/60 placeholder:font-normal hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition"
          />
          {busquedaOp && (
            <button
              onClick={() => setBusquedaOp('')}
              className="text-xs text-asfion-muted hover:text-asfion-navy"
              title="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>

        {(consignado !== 'todos' || busquedaOp) && (
          <button
            onClick={() => { setConsignado('todos'); setBusquedaOp(''); }}
            className="text-xs text-asfion-orange font-bold hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* KPIs principales — replican lo que pidió el cliente:
          Cabezas (con desglose M/H), Kg promedio, Inversión total. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Operaciones"
          value={formatNumber(kpis.totalOps)}
          accent="navy"
          icon={<PackageIcon size={18} />}
        />
        <Kpi
          label="Cabezas"
          value={kpis.cabezas > 0 ? formatNumber(kpis.cabezas) : '—'}
          sublabel={
            kpis.machos > 0 || kpis.hembras > 0
              ? `${formatNumber(kpis.machos)} ♂ · ${formatNumber(kpis.hembras)} ♀ (${
                  kpis.cabezas > 0 ? Math.round((kpis.machos / kpis.cabezas) * 100) : 0
                }% / ${
                  kpis.cabezas > 0 ? Math.round((kpis.hembras / kpis.cabezas) * 100) : 0
                }%)`
              : 'Total compradas'
          }
          accent="orange"
        />
        <Kpi
          label="Kg promedio"
          value={kpis.kgPromedio > 0 ? `${formatNumber(Math.round(kpis.kgPromedio))} kg` : '—'}
          sublabel={kpis.kgNetos > 0 ? `${formatNumber(Math.round(kpis.kgNetos))} kg netos total` : 'Por cabeza'}
          accent="navy"
        />
        <Kpi
          label="Inversión"
          value={kpis.inversion > 0 ? `$${formatNumber(Math.round(kpis.inversion))}` : '—'}
          sublabel={
            kpis.opsConDatos < kpis.totalOps
              ? `${kpis.opsConDatos} de ${kpis.totalOps} ops con precio`
              : 'Kg × precio'
          }
          accent="orange"
          icon={<CoinsIcon size={18} />}
        />
      </div>

      {/* Master-detail: lista a la izquierda + detalle a la derecha. En
          mobile (lg-) solo la lista; el detalle abre como modal cuando se
          clickea un ítem. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LISTA */}
        <Card
          title="Lista de Compras"
          subtitle={`${filtradas.length} operaciones — agrupadas por campo`}
          className="lg:col-span-2"
        >
          {filtradas.length === 0 ? (
            <p className="text-sm text-asfion-muted py-8 text-center italic">
              Sin operaciones con los filtros aplicados.
            </p>
          ) : (
            <div className="divide-y divide-asfion-borderSoft -mx-2">
              {agrupadas.map(([campo, ops]) => (
                <div key={campo} className="py-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-asfion-muted px-3 py-1.5 bg-asfion-bg/60 sticky top-0">
                    {campo} · {ops.length}
                  </p>
                  {ops.map(c => {
                    const isActive = seleccionada?.id === c.id;
                    const titulo = c.numeroOperacion?.trim() ||
                      (c.numeroDte ? `DTE ${c.numeroDte}` : c.id.slice(0, 6));
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSeleccionadaId(c.id)}
                        className={
                          'w-full text-left px-3 py-3 flex items-start gap-3 transition ' +
                          (isActive
                            ? 'bg-asfion-orangeSoft/40 border-l-4 border-asfion-orange'
                            : 'hover:bg-asfion-bg/60 border-l-4 border-transparent')
                        }
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-asfion-navyDeep tabular-nums">
                            {titulo}
                          </p>
                          <p className="text-xs text-asfion-muted mt-0.5 truncate">
                            {c.cantCabYCat ?? '—'}
                          </p>
                          <p className="text-[10px] text-asfion-muted tabular-nums mt-0.5">
                            {c.fecha}{c.consignado ? ` · ${c.consignado}` : ''}
                          </p>
                        </div>
                        <ChevronRightIcon
                          size={16}
                          className={isActive ? 'text-asfion-orange' : 'text-asfion-muted'}
                        />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* DETALLE — desktop */}
        <div className="hidden lg:block lg:col-span-3">
          {seleccionada ? (
            <DetalleOperacion
              compra={seleccionada}
              campoNombre={campoNombre(seleccionada.campoId)}
            />
          ) : (
            <Card title="Detalle" subtitle="Seleccioná una compra para ver todos sus datos">
              <p className="text-sm text-asfion-muted py-12 text-center italic">
                Sin operación seleccionada.
              </p>
            </Card>
          )}
        </div>

        {/* DETALLE — mobile modal. Solo cuando el usuario clickeó algo;
            si no, no abrimos modal sobre la lista. */}
        {seleccionada && seleccionadaId === seleccionada.id && (
          <div className="lg:hidden fixed inset-0 z-50 bg-asfion-navyDeep/60 flex items-end sm:items-center justify-center px-0 sm:px-4 py-0 sm:py-6 overflow-y-auto">
            <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl my-auto max-h-full overflow-y-auto">
              <div className="px-5 py-4 border-b border-asfion-borderSoft sticky top-0 bg-white z-10 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-asfion-navyDeep">
                    {seleccionada.numeroOperacion ?? 'Detalle'}
                  </h3>
                  <p className="text-xs text-asfion-muted">
                    {campoNombre(seleccionada.campoId)} · {seleccionada.fecha}
                  </p>
                </div>
                <button
                  onClick={() => setSeleccionadaId(null)}
                  className="p-2 -mr-2 text-asfion-muted hover:text-asfion-navyDeep"
                  aria-label="Cerrar"
                >
                  <XIcon size={20} />
                </button>
              </div>
              <div className="p-5">
                <DetalleOperacionBody compra={seleccionada} campoNombre={campoNombre(seleccionada.campoId)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// === Panel de detalle (desktop) ===

function DetalleOperacion({ compra, campoNombre }: { compra: Compra; campoNombre: string }) {
  const titulo = compra.numeroOperacion?.trim() || `Operación ${compra.id.slice(0, 6)}`;
  return (
    <Card title={titulo} subtitle={`${campoNombre} · ${compra.fecha}`}>
      <DetalleOperacionBody compra={compra} campoNombre={campoNombre} />
    </Card>
  );
}

// Body del detalle — sin Card wrapper, para reusar entre desktop card y
// mobile modal.
function DetalleOperacionBody({ compra, campoNombre }: { compra: Compra; campoNombre: string }) {
  // Construimos los rows del detalle. El orden replica el screenshot que
  // mandó el cliente: número operación, consignado, fecha, cant cab y cat,
  // kg netos origen / destino, merma %, km recorrido, número DTE, precio,
  // titular, plazo, observaciones.
  const filas: Array<[string, string | undefined | null]> = [
    ['Número de operación', compra.numeroOperacion],
    ['Consignado',          compra.consignado],
    ['Fecha',               compra.fecha],
    ['Campo',               campoNombre],
    ['Actividad',           compra.actividad],
    ['Cant cab y cat',      compra.cantCabYCat],
    ['Machos',              compra.totalMachos != null ? formatNumber(compra.totalMachos) : null],
    ['Hembras',             compra.totalHembras != null ? formatNumber(compra.totalHembras) : null],
    ['KG Netos Origen',     compra.kgNetosOrigen != null ? formatNumber(compra.kgNetosOrigen) : null],
    ['KG Netos Destino',    compra.kgNetosDestino != null ? formatNumber(compra.kgNetosDestino) : null],
    ['Merma %',             compra.mermaPorcentaje != null ? `${compra.mermaPorcentaje.toFixed(2)}%` : null],
    ['Kg corregidos',       compra.kgCorregidos != null ? formatNumber(compra.kgCorregidos) : null],
    ['Km recorrido',        compra.kmRecorrido != null ? formatNumber(compra.kmRecorrido) : null],
    ['Número DTE',          compra.numeroDte],
    ['Precio',              compra.precio != null ? `$${compra.precio.toLocaleString('es-AR')}` : null],
    ['Titular',             compra.titular],
    ['Plazo',               compra.plazo],
    ['Observaciones',       compra.observaciones],
    ['Cargado por',         compra.usuarioEmail],
  ];

  return (
    <dl className="divide-y divide-asfion-borderSoft -my-2">
      {filas.map(([label, value]) => {
        const display = value == null || value === '' ? '—' : value;
        const isEmpty = value == null || value === '';
        return (
          <div key={label} className="py-2.5 grid grid-cols-12 gap-3 items-baseline">
            <dt className="col-span-5 sm:col-span-4 text-xs uppercase tracking-wide font-semibold text-asfion-muted">
              {label}
            </dt>
            <dd className={
              'col-span-7 sm:col-span-8 text-sm break-words ' +
              (isEmpty ? 'text-asfion-muted italic' : 'text-asfion-navyDeep font-semibold')
            }>
              {display}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

// Export CSV de compras — una fila por operación, con TODAS las columnas
// del schema. Lo dejamos como estaba: útil para el contador del cliente.
function exportCompras(rows: Compra[], campos: Campo[]): void {
  const campoNombre = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;
  const cols: CsvColumn<Compra>[] = [
    { header: 'Número operación', value: r => r.numeroOperacion ?? '' },
    { header: 'Fecha',            value: r => r.fecha },
    { header: 'Campo',            value: r => campoNombre(r.campoId) },
    { header: 'Actividad',        value: r => r.actividad ?? '' },
    { header: 'Cant cab y cat',   value: r => r.cantCabYCat ?? '' },
    { header: 'Machos',           value: r => r.totalMachos  ?? '' },
    { header: 'Hembras',          value: r => r.totalHembras ?? '' },
    { header: 'KG Netos Origen',  value: r => r.kgNetosOrigen ?? '' },
    { header: 'KG Netos Destino', value: r => r.kgNetosDestino ?? '' },
    { header: 'Merma %',          value: r => r.mermaPorcentaje ?? '' },
    { header: 'Kg corregidos',    value: r => r.kgCorregidos ?? '' },
    { header: 'Precio',           value: r => r.precio ?? '' },
    { header: 'Consignado',       value: r => r.consignado ?? '' },
    { header: 'Titular',          value: r => r.titular ?? '' },
    { header: 'Plazo',            value: r => r.plazo ?? '' },
    { header: 'Número DTE',       value: r => r.numeroDte ?? '' },
    { header: 'Km recorrido',     value: r => r.kmRecorrido ?? '' },
    { header: 'Observaciones',    value: r => r.observaciones ?? '' },
    { header: 'Cargado por',      value: r => r.usuarioEmail },
    { header: 'Fecha de carga',   value: r => r.createdAt },
  ];
  const csv = rowsToCsv(rows, cols);
  downloadCsv(csv, csvFilename('compras'));
}
