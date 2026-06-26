// Página del módulo Preñez — réplica de la página 7 del Power BI de Agus
// ("Prenez"). Mide qué proporción del rodeo quedó preñada después del
// tacto, segmentado en cabeza/cuerpo/cola (cuando se hizo el servicio).
//
// KPIs (réplica directa del Power BI):
//   - Origen Total          = animales del rodeo (denominador base)
//   - Prenadas Totales      = preñadas confirmadas en tacto
//   - Vacias Totales        = vacías confirmadas en tacto
//   - % Preñez General      = Prenadas / Tactadas
//   - Faltan Tactar Total   = Origen − (Prenadas + Vacias)
//   - % Rodeo Evaluado      = Tactadas / Origen
//
// Charts:
//   - Bar chart: % Preñez por Rodeo (TITULO)
//   - 3 donuts por Rodeo: Preñez Cabeza · Cuerpo · Cola (segmento del
//     servicio en que quedó preñada — útil para evaluar fertilidad del
//     toro y respuesta del rodeo).
//
// Estado actual: la data hoy vive en planillas del veterinario que hace
// el tacto. Hasta que enchufemos la fuente (app móvil con form de tacto
// o sync de Excel), la página renderiza empty state. Cuando llega data
// poblada via prop `tactos`, todo renderea automático.

import React, { useMemo, useState } from 'react';
import { ActivityIcon, HeartIcon, TrendingUpIcon, UsersIcon } from 'lucide-react';
import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import { PageHeader } from '@/components/PageHeader';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { formatNumber, formatPercent } from '@/lib/utils';
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';

// El tipo Tacto vive en data/types.ts (lo movimos cuando hicimos el
// fetch desde Supabase). Re-exportamos como alias para compat con
// código existente que lo importaba desde acá.
import type { Tacto } from '@/data/types';
export type { Tacto };

interface Props {
  /** Tactos cargados. Por ahora siempre vacío; cuando enchufemos
   *  la fuente, se llena desde el server. */
  tactos?: Tacto[];
}

export function PrenezPage({ tactos = [] }: Props) {
  const [rodeo, setRodeo] = useState<string>('todos');

  const rodeosUnicos = useMemo(() => {
    const s = new Set(tactos.map(t => t.rodeo));
    return ['todos', ...Array.from(s).sort()];
  }, [tactos]);

  const filtrados = useMemo(() => {
    if (rodeo === 'todos') return tactos;
    return tactos.filter(t => t.rodeo === rodeo);
  }, [tactos, rodeo]);

  // KPIs globales — réplica del Power BI de Agus.
  // Toda la lógica es agregación simple (sumas y divisiones), no hay
  // promedios ponderados — cada vaca cuenta 1 al universo.
  const kpis = useMemo(() => {
    let origen = 0;
    let cabeza = 0, cuerpo = 0, cola = 0;
    let vacias = 0, perdon = 0, descarte = 0, feedLot = 0;
    filtrados.forEach(t => {
      origen   += t.origenTotal;
      cabeza   += t.prenezCabeza;
      cuerpo   += t.prenezCuerpo;
      cola     += t.prenezCola;
      vacias   += t.vacias;
      perdon   += t.perdon;
      descarte += t.descarte;
      feedLot  += t.feedLot;
    });
    const prenadas     = cabeza + cuerpo + cola;
    const tactadas     = prenadas + vacias + perdon + descarte + feedLot;
    const faltanTactar = Math.max(0, origen - tactadas);
    return {
      origen,
      prenadas,
      vacias,
      perdon,
      descarte,
      feedLot,
      cabeza,
      cuerpo,
      cola,
      faltanTactar,
      tactadas,
      pctPrenez:        tactadas > 0 ? prenadas / tactadas : 0,
      pctRodeoEvaluado: origen   > 0 ? tactadas / origen   : 0,
    };
  }, [filtrados]);

  // Tabla "por rodeo" — % preñez de cada rodeo individual.
  const porRodeo = useMemo(() => {
    const map = new Map<string, { prenadas: number; tactadas: number; origen: number }>();
    tactos.forEach(t => {
      const cur = map.get(t.rodeo) ?? { prenadas: 0, tactadas: 0, origen: 0 };
      const prenadas = t.prenezCabeza + t.prenezCuerpo + t.prenezCola;
      const tactadas = prenadas + t.vacias + t.perdon + t.descarte + t.feedLot;
      cur.prenadas += prenadas;
      cur.tactadas += tactadas;
      cur.origen   += t.origenTotal;
      map.set(t.rodeo, cur);
    });
    return Array.from(map.entries())
      .map(([nombre, v]) => ({
        rodeo: nombre,
        pctPrenez: v.tactadas > 0 ? v.prenadas / v.tactadas : 0,
        prenadas: v.prenadas,
        tactadas: v.tactadas,
        origen: v.origen,
      }))
      .sort((a, b) => b.pctPrenez - a.pctPrenez);
  }, [tactos]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Preñez"
        subtitle="Tactos del rodeo — % de preñez general y segmentado por momento de servicio."
        count={{ value: filtrados.length, label: 'tactos' }}
        actions={
          <ExportCsvButton
            onClick={() => exportPrenez(filtrados)}
            disabled={filtrados.length === 0}
            count={filtrados.length}
          />
        }
      />

      {/* Filtro por rodeo */}
      <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-asfion-muted">Rodeo</span>
          <select
            value={rodeo}
            onChange={e => setRodeo(e.target.value)}
            className="bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition cursor-pointer"
          >
            {rodeosUnicos.map(r => (
              <option key={r} value={r}>{r === 'todos' ? 'Todos los rodeos' : r}</option>
            ))}
          </select>
        </div>
      </div>

      {tactos.length === 0 ? (
        <Card title="Sin datos cargados" subtitle="Todavía no hay tactos cargados en el sistema">
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-asfion-orangeSoft flex items-center justify-center">
              <HeartIcon size={28} className="text-asfion-navyDeep" />
            </div>
            <p className="text-sm font-semibold text-asfion-navy">
              Todavía no hay tactos cargados.
            </p>
            <p className="text-xs text-asfion-muted max-w-md">
              Cuando se conecte la fuente (form de tacto en la app móvil o
              sync periódico de la planilla del veterinario), acá vas a ver
              los 6 KPIs globales (Origen, Preñadas, Vacías, % Preñez
              General, Faltan Tactar, % Rodeo Evaluado) más los donuts de
              preñez Cabeza/Cuerpo/Cola por rodeo, idénticos a la página
              "Prenez" del Power BI.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* KPIs principales — réplica del Power BI página 7 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Kpi
              label="Origen Total"
              value={formatNumber(kpis.origen)}
              sublabel="Animales del rodeo"
              accent="navy"
              icon={<UsersIcon size={18} />}
            />
            <Kpi
              label="Preñadas Totales"
              value={formatNumber(kpis.prenadas)}
              sublabel={kpis.tactadas > 0 ? `${formatPercent(kpis.pctPrenez)} de tactadas` : ''}
              accent="orange"
              icon={<HeartIcon size={18} />}
            />
            <Kpi
              label="Vacías Totales"
              value={formatNumber(kpis.vacias)}
              sublabel={kpis.tactadas > 0 ? `${formatPercent(1 - kpis.pctPrenez)} de tactadas` : ''}
              accent="terracota"
              icon={<ActivityIcon size={18} />}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Kpi
              label="% Preñez General"
              value={kpis.tactadas > 0 ? formatPercent(kpis.pctPrenez) : '—'}
              sublabel="Preñadas / Tactadas"
              accent="orange"
              icon={<TrendingUpIcon size={18} />}
            />
            <Kpi
              label="Faltan Tactar"
              value={formatNumber(kpis.faltanTactar)}
              sublabel="Origen − Tactadas"
              accent="navy"
              icon={<UsersIcon size={18} />}
            />
            <Kpi
              label="% Rodeo Evaluado"
              value={kpis.origen > 0 ? formatPercent(kpis.pctRodeoEvaluado) : '—'}
              sublabel="Tactadas / Origen"
              accent="navy"
              icon={<ActivityIcon size={18} />}
            />
          </div>

          {/* Charts row: % preñez por rodeo + segmentación cabeza/cuerpo/cola */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="% Preñez por Rodeo" subtitle="Ranking del rodeo con mejor performance reproductiva">
              <PorRodeoTabla rows={porRodeo} />
            </Card>
            <Card title="Segmentación de preñez" subtitle="Cuándo del servicio quedaron preñadas">
              <SegmentacionDonut cabeza={kpis.cabeza} cuerpo={kpis.cuerpo} cola={kpis.cola} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// === Helpers internos ===

interface RodeoRow {
  rodeo: string;
  pctPrenez: number;
  prenadas: number;
  tactadas: number;
  origen: number;
}

function PorRodeoTabla({ rows }: { rows: RodeoRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-asfion-muted py-6 text-center">Sin rodeos para mostrar.</p>;
  }
  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <table className="w-full text-sm min-w-[420px]">
        <thead>
          <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
            <th className="py-2 px-2 font-semibold whitespace-nowrap">Rodeo</th>
            <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Origen</th>
            <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Preñ / Tact</th>
            <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">% Preñez</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.rodeo} className="border-b border-asfion-borderSoft last:border-0">
              <td className="py-2 px-2 font-semibold text-asfion-navy whitespace-nowrap">{r.rodeo}</td>
              <td className="py-2 px-2 text-right tabular-nums text-asfion-muted">{formatNumber(r.origen)}</td>
              <td className="py-2 px-2 text-right tabular-nums text-asfion-muted whitespace-nowrap">
                {formatNumber(r.prenadas)} / {formatNumber(r.tactadas)}
              </td>
              <td className="py-2 px-2 text-right tabular-nums font-bold text-asfion-navy">
                {r.tactadas > 0 ? formatPercent(r.pctPrenez) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SegmentacionDonut({ cabeza, cuerpo, cola }: { cabeza: number; cuerpo: number; cola: number }) {
  const total = cabeza + cuerpo + cola;
  if (total === 0) {
    return (
      <p className="text-sm text-asfion-muted py-6 text-center">
        Sin datos de segmentación de servicio cargados.
      </p>
    );
  }
  const segments = [
    { label: 'Cabeza', value: cabeza, color: '#FF8409' }, // orange — primer tercio de servicio (mejor)
    { label: 'Cuerpo', value: cuerpo, color: '#FBC79A' }, // peach — segundo tercio
    { label: 'Cola',   value: cola,   color: '#163349' }, // navy  — tercer tercio (peor)
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 py-2">
      {segments.map(s => (
        <div key={s.label} className="flex flex-col items-center gap-2 min-w-0">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full grid place-items-center text-white font-extrabold text-xs sm:text-sm shadow-card"
            style={{ background: s.color }}
          >
            {formatPercent(s.value / total)}
          </div>
          <p className="text-[10px] sm:text-xs uppercase font-bold text-asfion-muted">{s.label}</p>
          <p className="text-[10px] sm:text-xs text-asfion-navy">{formatNumber(s.value)} cab.</p>
        </div>
      ))}
    </div>
  );
}

// Export CSV de Preñez — un row por tacto filtrado por rodeo.
function exportPrenez(rows: Tacto[]): void {
  const cols: CsvColumn<Tacto>[] = [
    { header: 'Rodeo',           value: r => r.rodeo },
    { header: 'Campo',           value: r => r.campo ?? '' },
    { header: 'Fecha',           value: r => r.fecha ?? '' },
    { header: 'Origen Total',    value: r => r.origenTotal },
    { header: 'Preñez Cabeza',   value: r => r.prenezCabeza },
    { header: 'Preñez Cuerpo',   value: r => r.prenezCuerpo },
    { header: 'Preñez Cola',     value: r => r.prenezCola },
    { header: 'Total Preñadas',  value: r => r.prenezCabeza + r.prenezCuerpo + r.prenezCola },
    { header: 'Vacías',          value: r => r.vacias },
    { header: 'Perdón',          value: r => r.perdon },
    { header: 'Descarte',        value: r => r.descarte },
    { header: 'Feed Lot',        value: r => r.feedLot },
  ];
  const csv = rowsToCsv(rows, cols);
  void downloadCsv(csv, csvFilename('prenez'));
}
