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

  const filas = useMemo(
    () => computeRotacion(pastoreo, campos, circuitos, modo, modo === 'mes' ? mesISO : null),
    [pastoreo, campos, circuitos, modo, mesISO],
  );

  const totales = useMemo(() => {
    if (filas.length === 0) return null;
    const dias = filas.reduce((s, r) => s + r.diasTotales, 0);
    const rot = filas.reduce((s, r) => s + r.rotaciones, 0);
    return { parcelas: filas.length, dias, rotaciones: rot, promedio: rot > 0 ? dias / rot : 0 };
  }, [filas]);

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

      {/* Selector Modo + Mes (cuando aplica) */}
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
                className="bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition cursor-pointer"
              >
                {mesesDisponibles.length === 0 && <option value={mesISO}>{mesISO}</option>}
                {mesesDisponibles.map(m => (
                  <option key={m} value={m}>{formatMes(m)}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Tabla */}
      <Card title="Detalle por parcela" subtitle="Ordenado por días totales descendente">
        {filas.length === 0 ? (
          <div className="py-10 text-center text-sm text-asfion-muted italic">
            Sin movimientos en {modo === 'mes' ? formatMes(mesISO) : 'el período cargado'}.
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
                  <th className="py-2 px-2 font-semibold">Última entrada</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(r => (
                  <tr key={r.parcelaId} className="border-b border-asfion-borderSoft/50 hover:bg-asfion-bg/60 transition">
                    <td className="py-2 px-2 text-asfion-muted">{r.campoNombre}</td>
                    <td className="py-2 px-2 text-asfion-muted">{r.circuitoNombre}</td>
                    <td className="py-2 px-2 font-semibold text-asfion-navyDeep">{r.parcela}</td>
                    <td className="py-2 px-2 tabular-nums font-semibold text-asfion-orange">{formatNumber(r.diasTotales)}</td>
                    <td className="py-2 px-2 tabular-nums">{r.rotaciones}</td>
                    <td className="py-2 px-2 tabular-nums">{r.diasPromedio.toFixed(1)}</td>
                    <td className="py-2 px-2 text-asfion-muted text-xs">{r.ultimaEntrada}</td>
                  </tr>
                ))}
              </tbody>
              {totales && (
                <tfoot>
                  <tr className="border-t-2 border-asfion-navyDeep bg-asfion-bg/40 font-bold">
                    <td className="py-3 px-2 text-asfion-navyDeep" colSpan={3}>
                      Total ({totales.parcelas} parcelas)
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
