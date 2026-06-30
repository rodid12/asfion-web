// =============================================================================
// PastoreoRotacionView — rotación por parcela
// =============================================================================
//
// Sub-vista nueva (pedida por el cliente) que responde la pregunta:
// "¿Cuántos días estuvo cada parcela ocupada y cuántas rotaciones tuvo?"
//
// Modos:
//   - "ciclo": agrega TODOS los stays de la parcela (toda la historia
//     cargada) — sirve para ver carga acumulada de cada parcela.
//   - "mes":   agrega solo el overlap entre cada stay y un mes
//     calendario seleccionado — sirve para ver actividad operativa
//     reciente ("este mes vs el anterior").
//
// Fuente de datos: tabla `pastoreo` (stays con fecha entrada/salida).
// Se filtra por campo si el usuario aplicó el filtro en PastoreoPage —
// para mantener consistencia con las otras vistas del módulo.

import React, { useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';
import { formatNumber } from '@/lib/utils';
import { fechaISOaLocal, dateAISO } from '@/lib/fechas';
import type { Campo, Circuito, Pastoreo } from '@/data/types';

type Modo = 'ciclo' | 'mes';

interface RotacionRow {
  campoNombre: string;
  circuitoNombre: string;
  parcela: string;             // "Parcela 1", "Parcela 2", etc.
  parcelaId: string;
  diasTotales: number;
  rotaciones: number;
  diasPromedio: number;        // = diasTotales / rotaciones
  ultimaEntrada: string;       // ISO — para ordenar y mostrar
}

interface Props {
  pastoreo: Pastoreo[];
  campos: Campo[];
  circuitos: Circuito[];
}

const MS_POR_DIA = 86400000;

// ---------------------------------------------------------------------------
// Helpers de fecha — operan sobre Date local (sin TZ tricks)
// ---------------------------------------------------------------------------

function startOfMonth(iso: string): Date {
  return new Date(iso + '-01T00:00:00');
}

function endOfMonth(iso: string): Date {
  const d = startOfMonth(iso);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);  // último día del mes anterior = último día del mes original
  return d;
}

function diffDiasInclusive(desde: Date, hasta: Date): number {
  // +1 para que un stay del 1 al 1 cuente como 1 día (no 0).
  return Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA) + 1);
}

// ---------------------------------------------------------------------------
// Cómputo
// ---------------------------------------------------------------------------

function computeRotacion(
  stays: Pastoreo[],
  campos: Campo[],
  circuitos: Circuito[],
  modo: Modo,
  mesISO: string | null,    // 'YYYY-MM' cuando modo === 'mes'
): RotacionRow[] {
  const campoMap = new Map(campos.map(c => [c.id, c.nombre]));
  const circuitoMap = new Map(circuitos.map(c => [c.id, c.nombre]));
  const hoy = new Date();

  // Rango temporal del filtro (solo aplica en modo 'mes')
  let mesInicio: Date | null = null;
  let mesFin: Date | null = null;
  if (modo === 'mes' && mesISO) {
    mesInicio = startOfMonth(mesISO);
    mesFin = endOfMonth(mesISO);
  }

  const buckets = new Map<string, RotacionRow>();

  for (const s of stays) {
    if (!s.fecha) continue;
    // Solo eventos de movimiento (entrada/rotación). Excluimos Muerte
    // y Salida pura porque no implican ocupación nueva de parcela.
    const ev = (s.evento ?? '').toLowerCase();
    if (ev && ev !== 'entrada' && ev !== 'rotacion' && ev !== 'rotación') continue;

    const entrada = fechaISOaLocal(s.fecha);
    const salida = s.fechaSalida ? fechaISOaLocal(s.fechaSalida) : hoy;

    let diasContados: number;
    if (modo === 'mes' && mesInicio && mesFin) {
      // Overlap [entrada,salida] ∩ [mesInicio,mesFin]
      const inicio = entrada > mesInicio ? entrada : mesInicio;
      const fin    = salida  < mesFin    ? salida  : mesFin;
      if (fin < inicio) continue;   // sin overlap → este stay no aporta al mes
      diasContados = diffDiasInclusive(inicio, fin);
    } else {
      diasContados = diffDiasInclusive(entrada, salida);
    }

    const key = s.parcelaId || `(sin-parcela)`;
    const existing = buckets.get(key);
    if (existing) {
      existing.diasTotales += diasContados;
      existing.rotaciones += 1;
      if (s.fecha > existing.ultimaEntrada) existing.ultimaEntrada = s.fecha;
    } else {
      buckets.set(key, {
        campoNombre:     campoMap.get(s.campoId) ?? '(sin campo)',
        circuitoNombre:  circuitoMap.get(s.circuitoId) ?? '(sin circuito)',
        parcela:         s.parcelaNumero != null ? `Parcela ${s.parcelaNumero}` : s.parcelaId,
        parcelaId:       key,
        diasTotales:     diasContados,
        rotaciones:      1,
        diasPromedio:    0,        // se calcula al final
        ultimaEntrada:   s.fecha,
      });
    }
  }

  return [...buckets.values()]
    .map(r => ({ ...r, diasPromedio: r.rotaciones > 0 ? r.diasTotales / r.rotaciones : 0 }))
    .sort((a, b) => b.diasTotales - a.diasTotales);
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function PastoreoRotacionView({ pastoreo, campos, circuitos }: Props) {
  const [modo, setModo] = useState<Modo>('ciclo');
  const [campoFiltro, setCampoFiltro] = useState<string>('todos');           // id del campo
  const [circuitoFiltro, setCircuitoFiltro] = useState<string>('todos');     // id del circuito

  // Mes default = el más reciente con data (sino hoy)
  const mesesDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const s of pastoreo) {
      if (s.fecha && s.fecha.length >= 7) set.add(s.fecha.slice(0, 7));
    }
    return [...set].sort().reverse();
  }, [pastoreo]);
  const [mesISO, setMesISO] = useState<string>(() => {
    return mesesDisponibles[0] ?? dateAISO(new Date()).slice(0, 7);
  });

  // Opciones de circuito dependen del campo seleccionado — si el cliente
  // filtra "Carolina", solo le mostramos circuitos de Carolina en el dropdown.
  const circuitosOpts = useMemo(() => {
    if (campoFiltro === 'todos') return circuitos;
    return circuitos.filter(c => c.campoId === campoFiltro);
  }, [circuitos, campoFiltro]);

  // Aplicamos los filtros de campo/circuito ANTES de pasar a computeRotacion,
  // así el cálculo de "promedio del set" para el highlight terracota/rojo
  // refleja el subconjunto que el cliente está viendo, no el total global.
  const pastoreoFiltrado = useMemo(() => {
    return pastoreo.filter(s => {
      if (campoFiltro !== 'todos' && s.campoId !== campoFiltro) return false;
      if (circuitoFiltro !== 'todos' && s.circuitoId !== circuitoFiltro) return false;
      return true;
    });
  }, [pastoreo, campoFiltro, circuitoFiltro]);

  const filas = useMemo(
    () => computeRotacion(pastoreoFiltrado, campos, circuitos, modo, modo === 'mes' ? mesISO : null),
    [pastoreoFiltrado, campos, circuitos, modo, mesISO],
  );

  const totales = useMemo(() => {
    if (filas.length === 0) return null;
    const dias = filas.reduce((s, r) => s + r.diasTotales, 0);
    const rot = filas.reduce((s, r) => s + r.rotaciones, 0);
    return { parcelas: filas.length, dias, rotaciones: rot, promedio: rot > 0 ? dias / rot : 0 };
  }, [filas]);

  // Umbral para colorear filas según riesgo agronómico. La idea (validada
  // con el cliente): una parcela que se usa MUCHO más que el promedio del
  // set está en riesgo de quedarse sin pastura.
  //   - terracota suave: > 1× promedio  (uso alto, monitorear)
  //   - terracota fuerte: > 2× promedio (riesgo, frenar rotaciones)
  // Promedio = mediana ponderada por días, calculado sobre el set visible
  // (= post filtros), para que cambie cuando el cliente zoomea a un circuito.
  const promedioDias = useMemo(() => {
    if (filas.length === 0) return 0;
    return filas.reduce((s, r) => s + r.diasTotales, 0) / filas.length;
  }, [filas]);

  const hoy = useMemo(() => new Date(), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rotación por parcela"
        subtitle={
          modo === 'ciclo'
            ? 'Días totales y cantidad de movimientos por parcela en todo el período cargado.'
            : 'Días que cada parcela estuvo ocupada en el mes seleccionado.'
        }
        count={{ value: filas.length, label: 'parcelas' }}
        actions={
          <ExportCsvButton
            onClick={() => exportRotacion(filas, modo, mesISO)}
            disabled={filas.length === 0}
            count={filas.length}
          />
        }
      />

      {/* Selector Modo + Mes + Campo + Circuito */}
      <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-asfion-muted">Vista</span>
          {(['ciclo', 'mes'] as Modo[]).map(m => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={
                'px-3 py-1.5 rounded-lg text-sm font-semibold transition ' +
                (modo === m
                  ? 'bg-asfion-navy text-white'
                  : 'bg-asfion-bg text-asfion-navy hover:bg-asfion-orangeSoft/25')
              }
            >
              {m === 'ciclo' ? 'Ciclo completo' : 'Por mes'}
            </button>
          ))}
        </div>

        {modo === 'mes' && (
          <>
            <div className="h-8 w-px bg-asfion-borderSoft" />
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-semibold text-asfion-muted">Mes</span>
              <select
                value={mesISO}
                onChange={e => setMesISO(e.target.value)}
                className={SELECT_CLASSES}
              >
                {mesesDisponibles.length === 0 && <option value={mesISO}>{mesISO}</option>}
                {mesesDisponibles.map(m => (
                  <option key={m} value={m}>{formatMes(m)}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="h-8 w-px bg-asfion-borderSoft" />

        {/* Campo: cambiar reset el filtro de circuito porque las opciones
            del dropdown dependen del campo (no queremos que quede un
            circuito de otro campo seleccionado). */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-asfion-muted">Campo</span>
          <select
            value={campoFiltro}
            onChange={e => { setCampoFiltro(e.target.value); setCircuitoFiltro('todos'); }}
            className={SELECT_CLASSES}
          >
            <option value="todos">Todos</option>
            {campos.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-asfion-muted">Circuito</span>
          <select
            value={circuitoFiltro}
            onChange={e => setCircuitoFiltro(e.target.value)}
            className={SELECT_CLASSES}
            disabled={circuitosOpts.length === 0}
          >
            <option value="todos">Todos</option>
            {circuitosOpts.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Leyenda de colores — explica el highlight visual de riesgo agronómico */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-asfion-muted">
        <span className="font-semibold uppercase">Riesgo agronómico:</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-asfion-orange/15 border border-asfion-orange/40" />
          Uso alto (&gt; promedio)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-asfion-terracota/20 border border-asfion-terracota/50" />
          Sobreuso (&gt; 2× promedio — riesgo de quedarse sin pastura)
        </span>
      </div>

      {/* Tabla */}
      <Card title="Detalle por parcela" subtitle="Ordenado por días totales descendente">
        {filas.length === 0 ? (
          <div className="py-10 text-center text-sm text-asfion-muted italic">
            Sin movimientos en {modo === 'mes' ? formatMes(mesISO) : 'el período cargado'}
            {(campoFiltro !== 'todos' || circuitoFiltro !== 'todos') ? ' con los filtros aplicados' : ''}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
                  <th className="py-2 px-2 font-semibold">Campo</th>
                  <th className="py-2 px-2 font-semibold">Circuito</th>
                  <th className="py-2 px-2 font-semibold">Parcela</th>
                  <th className="py-2 px-2 font-semibold tabular-nums">Días totales</th>
                  <th className="py-2 px-2 font-semibold tabular-nums">Rotaciones</th>
                  <th className="py-2 px-2 font-semibold tabular-nums">Días promedio</th>
                  <th className="py-2 px-2 font-semibold">Última rotación</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(r => {
                  const riesgo = clasificarRiesgo(r.diasTotales, promedioDias);
                  return (
                    <tr
                      key={r.parcelaId}
                      className={
                        'border-b border-asfion-borderSoft/50 hover:bg-asfion-bg/60 transition ' +
                        (riesgo === 'alto'      ? 'bg-asfion-terracota/10' :
                         riesgo === 'moderado'  ? 'bg-asfion-orange/8'     : '')
                      }
                      title={
                        riesgo === 'alto'      ? 'Sobreuso — más del doble del promedio del set visible' :
                        riesgo === 'moderado'  ? 'Uso alto — supera el promedio del set visible' : undefined
                      }
                    >
                      <td className="py-2 px-2 text-asfion-muted">{r.campoNombre}</td>
                      <td className="py-2 px-2 text-asfion-muted">{r.circuitoNombre}</td>
                      <td className="py-2 px-2 font-semibold text-asfion-navyDeep">
                        {r.parcela}
                        {riesgo === 'alto' && (
                          <span className="ml-2 text-[10px] uppercase font-bold text-asfion-terracota">⚠ sobreuso</span>
                        )}
                      </td>
                      <td className={
                        'py-2 px-2 tabular-nums font-semibold ' +
                        (riesgo === 'alto' ? 'text-asfion-terracota' : 'text-asfion-orange')
                      }>
                        {formatNumber(r.diasTotales)}
                      </td>
                      <td className="py-2 px-2 tabular-nums">{r.rotaciones}</td>
                      <td className="py-2 px-2 tabular-nums">{r.diasPromedio.toFixed(1)}</td>
                      <td className="py-2 px-2 text-asfion-muted text-xs">{relativoEnDias(r.ultimaEntrada, hoy)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {totales && (
                <tfoot>
                  <tr className="border-t-2 border-asfion-navyDeep bg-asfion-bg/40 font-bold">
                    <td className="py-3 px-2 text-asfion-navyDeep" colSpan={3}>
                      Total ({totales.parcelas} parcelas) — promedio del set: {promedioDias.toFixed(0)} días
                    </td>
                    <td className="py-3 px-2 tabular-nums text-asfion-orange">{formatNumber(totales.dias)}</td>
                    <td className="py-3 px-2 tabular-nums text-asfion-navyDeep">{totales.rotaciones}</td>
                    <td className="py-3 px-2 tabular-nums text-asfion-navyDeep">{totales.promedio.toFixed(1)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------

const MESES_LARGOS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

function formatMes(iso: string): string {
  // 'YYYY-MM' → 'Enero 2026'
  const [y, m] = iso.split('-');
  const idx = parseInt(m ?? '1', 10) - 1;
  const nombre = MESES_LARGOS[Math.max(0, Math.min(11, idx))];
  return `${nombre} ${y}`;
}

/** Clase Tailwind reutilizada para los <select> de la barra de filtros. */
const SELECT_CLASSES =
  'bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 ' +
  'text-sm font-semibold text-asfion-navy ' +
  'hover:bg-asfion-orangeSoft/25 ' +
  'focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer';

/** Clasifica el riesgo agronómico de una parcela según cuánto se usa
 *  comparado al promedio del set visible.
 *   - 'alto':     > 2× promedio (sobreuso real, posible riesgo)
 *   - 'moderado': > 1× promedio (uso por encima del promedio)
 *   - 'normal':   <= promedio
 *  Si promedio es 0 (set vacío), devuelve 'normal' para evitar pintar todo. */
function clasificarRiesgo(diasTotales: number, promedio: number): 'alto' | 'moderado' | 'normal' {
  if (promedio <= 0) return 'normal';
  if (diasTotales > promedio * 2) return 'alto';
  if (diasTotales > promedio) return 'moderado';
  return 'normal';
}

/** Devuelve "hoy", "ayer", "hace 12 días", etc. Para fechas futuras
 *  (raro pero defensivo) devuelve la fecha ISO sin transformar. */
function relativoEnDias(iso: string, hoy: Date): string {
  if (!iso) return '—';
  const d = fechaISOaLocal(iso);
  const diffMs = hoy.getTime() - d.getTime();
  const dias = Math.floor(diffMs / MS_POR_DIA);
  if (dias < 0) return iso;
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  if (dias < 60) return 'hace 1 mes';
  if (dias < 365) return `hace ${Math.round(dias / 30)} meses`;
  return `hace ${Math.round(dias / 365)} año${dias >= 365 * 2 ? 's' : ''}`;
}

function exportRotacion(rows: RotacionRow[], modo: Modo, mesISO: string): void {
  const cols: CsvColumn<RotacionRow>[] = [
    { header: 'Campo',          value: r => r.campoNombre },
    { header: 'Circuito',       value: r => r.circuitoNombre },
    { header: 'Parcela',        value: r => r.parcela },
    { header: 'Días totales',   value: r => r.diasTotales },
    { header: 'Rotaciones',     value: r => r.rotaciones },
    { header: 'Días promedio',  value: r => r.diasPromedio.toFixed(2) },
    { header: 'Última entrada', value: r => r.ultimaEntrada },
  ];
  const sufijo = modo === 'mes' ? `-${mesISO}` : '-ciclo';
  void downloadCsv(rowsToCsv(rows, cols), csvFilename(`rotacion${sufijo}`));
}
