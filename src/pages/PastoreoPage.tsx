// =============================================================================
// PastoreoPage — Visualizador de Ciclos con 3 Etapas (Largada/Control/Final)
// =============================================================================
//
// Reescritura (junio 2026) sobre la tabla nueva `pastoreo_ciclos` (migration
// 0018). El cliente nos pasó el Excel "cierre pastoreo 26(2).xlsx" Hoja 1
// con el modelo definitivo: cada grupo tiene 3 etapas de pesaje (Largada,
// Control intermedio opcional, Final/Cierre).
//
// El requerimiento textual fue:
//   "Lo ideal seria que en el visualizador de pastoreo podamos ver lo que
//    tiene el Bi, que son los globitos que salen pero habria que filtrar
//    por Circuito, y categoria (Novillo/Vaquilla/Vaq 15m/ Vaq 27M) y por
//    largada, final, para que los globos se actualicen"
//
// Implementación:
//   • Filtros: Campo, Circuito, Categoría, Etapa (Largada/Control/Final)
//   • Globitos (KPIs) que cambian según la etapa elegida:
//       - Cantidad de animales · Has · Kg/Cab · Kg Totales · Carga Ca/Ha
//       - Para Control/Final agrega: Kg producidos/animal, Días pastoreo,
//         GDPV, Kg producidos/Ha
//   • Tabla con todos los ciclos filtrados
//   • Charts: cabezas por campo · kg producidos/Ha por circuito
//
// La sección "Entradas históricas" (PastoreoEntradasView) sigue embebida
// abajo para no perder la data ya cargada por la app móvil.

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
  CalendarDaysIcon,
  CircleDotIcon,
  LandPlotIcon,
  ScaleIcon,
  TrendingUpIcon,
  UsersIcon,
  WeightIcon,
} from 'lucide-react';
import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import { PageHeader } from '@/components/PageHeader';
import { EmptyModule } from '@/components/EmptyModule';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { formatNumber } from '@/lib/utils';
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';
import type { Campo, Circuito, Pastoreo, PastoreoCiclo } from '@/data/types';
import { PastoreoEntradasView } from './PastoreoEntradasView';

// ─────────────────────────────────────────────────────────────────────────────
// Etapas — definimos un type discriminado para que el resto del código pueda
// derivar qué campos del ciclo leer según cuál es la activa. "Todas" significa
// "agregar a través de las 3 etapas" (default).
// ─────────────────────────────────────────────────────────────────────────────
type Etapa = 'todas' | 'largada' | 'control' | 'final';

const ETAPAS: { key: Etapa; label: string; hint: string }[] = [
  { key: 'todas',   label: 'Todas',   hint: 'Vista general'         },
  { key: 'largada', label: 'Largada', hint: 'Datos de ingreso'      },
  { key: 'control', label: 'Control', hint: 'Pesaje intermedio'     },
  { key: 'final',   label: 'Final',   hint: 'Cierre / encierre'     },
];

// Categorías canónicas según el Excel del cliente. Normalizamos para que
// "novillito" (lowercase) y "Novillito" colapsen al mismo bucket en el
// dropdown.
function normalizarCategoria(c: string): string {
  const t = (c ?? '').trim().toLowerCase();
  if (t.startsWith('novil'))      return 'Novillos';
  if (t.startsWith('vaq a 27'))   return 'Vaq 27M';
  if (t.startsWith('vaq 15'))     return 'Vaq 15M';
  if (t.startsWith('vaq'))        return 'Vaquillas';
  return c;
}

interface Props {
  /** Ciclos con 3 etapas (fuente principal — Excel del cliente). */
  pastoreoCiclos: PastoreoCiclo[];
  /** Stays viejos cargados por la app móvil (se muestran abajo, no en KPIs). */
  pastoreo: Pastoreo[];
  campos: Campo[];
  circuitos: Circuito[];
}

export function PastoreoPage({ pastoreoCiclos, pastoreo, campos, circuitos }: Props) {
  const [campo, setCampo] = useState<string>('todos');
  const [circuito, setCircuito] = useState<string>('todos');
  const [categoria, setCategoria] = useState<string>('todas');
  const [etapa, setEtapa] = useState<Etapa>('todas');

  // Opciones dinámicas según la data — solo mostramos lo que existe.
  const campoOpts = useMemo(() => {
    const set = new Set<string>();
    for (const c of pastoreoCiclos) set.add(c.campoNombre);
    return Array.from(set).sort();
  }, [pastoreoCiclos]);

  const circuitoOpts = useMemo(() => {
    const set = new Set<string>();
    for (const c of pastoreoCiclos) {
      if (campo === 'todos' || c.campoNombre === campo) set.add(c.circuitoNombre);
    }
    return Array.from(set).sort();
  }, [pastoreoCiclos, campo]);

  const categoriaOpts = useMemo(() => {
    const set = new Set<string>();
    for (const c of pastoreoCiclos) set.add(normalizarCategoria(c.categoria));
    return Array.from(set).sort();
  }, [pastoreoCiclos]);

  // Si cambia el campo y el circuito previamente elegido no existe en el
  // nuevo subset, lo reseteo. (Evita estado "huérfano" donde se filtra por
  // un circuito que ningún ciclo cumple.)
  React.useEffect(() => {
    if (circuito !== 'todos' && !circuitoOpts.includes(circuito)) {
      setCircuito('todos');
    }
  }, [circuito, circuitoOpts]);

  // Dos niveles de filtrado para evitar recalcular charts al cambiar etapa:
  //  - filtradosSinEtapa = filter por campo/circuito/categoria → lo usan
  //    los CHARTS (porCampo, porCircuito). Cambiar etapa no los toca.
  //  - filtrados = filtradosSinEtapa + filter por etapa → lo usan los KPIs,
  //    que sí deben respetar la etapa elegida (descartar ciclos sin
  //    fecha_control si etapa='control', etc).
  const filtradosSinEtapa = useMemo(() => {
    return pastoreoCiclos.filter(c => {
      if (campo     !== 'todos'  && c.campoNombre !== campo)                        return false;
      if (circuito  !== 'todos'  && c.circuitoNombre !== circuito)                  return false;
      if (categoria !== 'todas'  && normalizarCategoria(c.categoria) !== categoria) return false;
      return true;
    });
  }, [pastoreoCiclos, campo, circuito, categoria]);

  const filtrados = useMemo(() => {
    if (etapa === 'todas' || etapa === 'largada') return filtradosSinEtapa;
    return filtradosSinEtapa.filter(c => {
      if (etapa === 'control' && c.fechaControl == null)  return false;
      if (etapa === 'final'   && c.fechaEncierre == null) return false;
      return true;
    });
  }, [filtradosSinEtapa, etapa]);

  // ─────────────────────────────────────────────────────────────────────────
  // Cálculo de KPIs ("globitos" del Power BI).
  //
  // Reglas:
  //   - Todas las sumas / promedios ignoran undefined/null para no contaminar.
  //   - Promedios ponderados por cant_animales — replica el comportamiento
  //     de un Power BI donde sumás kg totales y dividís por sum(cabezas).
  //   - "Has Circuito" se cuenta UNA SOLA VEZ por circuito (un circuito de
  //     200ha que tiene Novillos + Vaquillas en distintos ciclos = 200ha,
  //     no 400ha).
  // ─────────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const sum = (xs: (number | undefined)[]) =>
      xs.reduce<number>((s, x) => s + (x ?? 0), 0);

    const cabezas = sum(filtrados.map(c => c.cantAnimales));

    // Has Circuito — sumamos hectáreas únicas (clave = campo+circuito).
    const seenCirc = new Set<string>();
    let hasTot = 0;
    for (const c of filtrados) {
      const key = `${c.campoNombre}::${c.circuitoNombre}`;
      if (seenCirc.has(key)) continue;
      seenCirc.add(key);
      hasTot += c.hasCircuito ?? 0;
    }

    // Selector de columnas según etapa.
    //   largada → kg_neto_ingreso_desbaste, kg_totales_carne_ingreso, carga_kg_carne_ha_real
    //   control → kg_neto_control, ..., gdpv_control, kg_producidos_animal_control, etc.
    //   final   → kg_neto_final, ..., gdpv_final, kg_producidos_animal_final, etc.
    //   todas   → preferimos Final si existe, sino Control, sino Largada
    function pickKgNeto(c: PastoreoCiclo): number | undefined {
      if (etapa === 'largada') return c.kgNetoIngresoDesbaste;
      if (etapa === 'control') return c.kgNetoControl;
      if (etapa === 'final')   return c.kgNetoFinal;
      return c.kgNetoFinal ?? c.kgNetoControl ?? c.kgNetoIngresoDesbaste;
    }
    function pickKgTotales(c: PastoreoCiclo): number | undefined {
      if (etapa === 'largada') return c.kgTotalesCarneIngreso;
      if (etapa === 'control') return c.kgTotalesCarneControl;
      if (etapa === 'final')   return c.kgTotalesCarneFinal;
      return c.kgTotalesCarneFinal ?? c.kgTotalesCarneControl ?? c.kgTotalesCarneIngreso;
    }
    function pickGdpv(c: PastoreoCiclo): number | undefined {
      if (etapa === 'control') return c.gdpvControl;
      if (etapa === 'final')   return c.gdpvFinal;
      if (etapa === 'todas')   return c.gdpvFinal ?? c.gdpvControl;
      return undefined; // Largada no tiene GDPV
    }
    function pickKgProdAnim(c: PastoreoCiclo): number | undefined {
      if (etapa === 'control') return c.kgCarneProducidosAnimalControl;
      if (etapa === 'final')   return c.kgCarneProducidosAnimalFinal;
      if (etapa === 'todas')   return c.kgCarneProducidosAnimalFinal ?? c.kgCarneProducidosAnimalControl;
      return undefined;
    }
    function pickKgProdHa(c: PastoreoCiclo): number | undefined {
      if (etapa === 'control') return c.kgCarneProducidosHaControl;
      if (etapa === 'final')   return c.kgCarneProducidosHaFinal;
      if (etapa === 'todas')   return c.kgCarneProducidosHaFinal ?? c.kgCarneProducidosHaControl;
      return undefined;
    }
    function pickDias(c: PastoreoCiclo): number | undefined {
      if (etapa === 'control') return c.diasPastoreoControl;
      if (etapa === 'final')   return c.diasPastoreoFinal;
      if (etapa === 'todas')   return c.diasPastoreoFinal ?? c.diasPastoreoControl;
      return undefined;
    }

    const kgTot     = sum(filtrados.map(pickKgTotales));
    // KG/Cab ponderado: kg_totales / cabezas (= AVG(kg_neto) ponderado por cabezas).
    const kgPorCab  = cabezas > 0 ? kgTot / cabezas : 0;

    // Carga real: kg_totales / has — solo si hay has.
    const cargaKgHa = hasTot > 0 ? kgTot / hasTot : 0;
    const cargaCaHa = hasTot > 0 ? cabezas / hasTot : 0;

    // Promedios ponderados (por cant_animales) — coincide con DAX del PBI
    // AVERAGEX si los pesos son las cabezas. Si no hay cabezas, devolvemos 0.
    function weightedAvg(picker: (c: PastoreoCiclo) => number | undefined): number {
      let num = 0, den = 0;
      for (const c of filtrados) {
        const v = picker(c);
        const w = c.cantAnimales ?? 0;
        if (v != null && w > 0) { num += v * w; den += w; }
      }
      return den > 0 ? num / den : 0;
    }

    const gdpv          = weightedAvg(pickGdpv);
    const kgProdPorAnim = weightedAvg(pickKgProdAnim);
    const kgProdPorHa   = weightedAvg(pickKgProdHa);
    const diasProm      = weightedAvg(pickDias);

    // Cantidad de ciclos con cada etapa cargada (info para sublabels).
    const cClosed   = filtrados.filter(c => c.fechaEncierre != null).length;
    const cControl  = filtrados.filter(c => c.fechaControl  != null).length;

    return {
      ciclos: filtrados.length,
      cabezas,
      hasTot,
      kgTot,
      kgPorCab,
      cargaCaHa,
      cargaKgHa,
      gdpv,
      kgProdPorAnim,
      kgProdPorHa,
      diasProm,
      cClosed,
      cControl,
    };
  }, [filtrados, etapa]);

  // ─────────────────────────────────────────────────────────────────────────
  // Charts — cabezas por campo, kg producidos/Ha por circuito (filtrados)
  // ─────────────────────────────────────────────────────────────────────────
  // Charts usan filtradosSinEtapa porque la cantidad de cabezas y kg/Ha de
  // un ciclo son los mismos sin importar qué etapa esté mirando el usuario.
  // Evita recalcular ~30ms al togglear Largada/Control/Final.
  const porCampo = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of filtradosSinEtapa) {
      m.set(c.campoNombre, (m.get(c.campoNombre) ?? 0) + (c.cantAnimales ?? 0));
    }
    return Array.from(m, ([nombre, cabezas]) => ({ nombre, cabezas }))
      .sort((a, b) => b.cabezas - a.cabezas);
  }, [filtradosSinEtapa]);

  const porCircuito = useMemo(() => {
    const m = new Map<string, { kg: number; w: number }>();
    for (const c of filtradosSinEtapa) {
      const v = c.kgCarneProducidosHaFinal ?? c.kgCarneProducidosHaControl;
      const w = c.cantAnimales ?? 0;
      if (v == null || w === 0) continue;
      const key = `${c.campoNombre} · ${c.circuitoNombre}`;
      const acc = m.get(key) ?? { kg: 0, w: 0 };
      acc.kg += v * w; acc.w += w;
      m.set(key, acc);
    }
    return Array.from(m, ([nombre, { kg, w }]) => ({ nombre, kgPorHa: w > 0 ? kg / w : 0 }))
      .sort((a, b) => b.kgPorHa - a.kgPorHa)
      .slice(0, 10);
  }, [filtradosSinEtapa]);

  // ─────────────────────────────────────────────────────────────────────────
  // Export CSV — todas las columnas relevantes de las 3 etapas
  // ─────────────────────────────────────────────────────────────────────────
  const csvCols: CsvColumn<PastoreoCiclo>[] = [
    { header: 'Campo',           value: c => c.campoNombre },
    { header: 'Circuito',        value: c => c.circuitoNombre },
    { header: 'Categoría',       value: c => c.categoria },
    { header: 'Has',             value: c => c.hasCircuito ?? '' },
    { header: 'Cabezas',         value: c => c.cantAnimales ?? '' },
    { header: 'Carga Ca/Ha',     value: c => c.cargaCaHa ?? '' },
    { header: 'Fecha Largada',   value: c => c.fechaIngreso ?? '' },
    { header: 'Peso Largada',    value: c => c.pesoPromIngresoSinDesbaste ?? '' },
    { header: 'Kg neto Largada', value: c => c.kgNetoIngresoDesbaste ?? '' },
    { header: 'Fecha Control',   value: c => c.fechaControl ?? '' },
    { header: 'Kg neto Control', value: c => c.kgNetoControl ?? '' },
    { header: 'GDPV Control',    value: c => c.gdpvControl ?? '' },
    { header: 'Fecha Final',     value: c => c.fechaEncierre ?? '' },
    { header: 'Kg neto Final',   value: c => c.kgNetoFinal ?? '' },
    { header: 'GDPV Final',      value: c => c.gdpvFinal ?? '' },
    { header: 'Kg prod/animal',  value: c => c.kgCarneProducidosAnimalFinal ?? c.kgCarneProducidosAnimalControl ?? '' },
    { header: 'Días pastoreo',   value: c => c.diasPastoreoFinal ?? c.diasPastoreoControl ?? '' },
  ];

  function exportarCsv() {
    const csv = rowsToCsv(filtrados, csvCols);
    downloadCsv(csv, csvFilename('pastoreo-ciclos'));
  }

  function limpiarFiltros() {
    setCampo('todos'); setCircuito('todos'); setCategoria('todas'); setEtapa('todas');
  }

  // Empty state si todavía no se aplicó la migración 0018 o no hay data.
  if (pastoreoCiclos.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pastoreo" subtitle="Ciclos completos (Largada · Control · Final)" />
        <EmptyModule label="ciclos de pastoreo" />
        {/* Stays viejos siguen visibles abajo si los hay */}
        <PastoreoEntradasView pastoreo={pastoreo} campos={campos} circuitos={circuitos} embedded />
      </div>
    );
  }

  const hayFiltrosActivos =
    campo !== 'todos' || circuito !== 'todos' || categoria !== 'todas' || etapa !== 'todas';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pastoreo"
        subtitle={`Ciclos completos · Largada · Control · Final  ·  ${kpis.ciclos} ciclos filtrados`}
        actions={<ExportCsvButton onClick={exportarCsv} count={filtrados.length} />}
      />

      {/* ─────────────────────────────────────────────────────────────────
          FILTROS — Campo · Circuito · Categoría · Etapa
          ────────────────────────────────────────────────────────────── */}
      <Card>
        {/* gap-4 + md:gap-5 da más respiro entre los 4 dropdowns. El Card
            base ahora aplica p-5 cuando no hay header (fix en Card.tsx)
            así que el filter bar también respira top/bottom. */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-asfion-muted">Campo</label>
            <select
              value={campo}
              onChange={e => setCampo(e.target.value)}
              className="rounded-lg border border-asfion-borderSoft bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-asfion-orange"
            >
              <option value="todos">Todos</option>
              {campoOpts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-asfion-muted">Circuito</label>
            <select
              value={circuito}
              onChange={e => setCircuito(e.target.value)}
              className="rounded-lg border border-asfion-borderSoft bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-asfion-orange"
            >
              <option value="todos">Todos</option>
              {circuitoOpts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-asfion-muted">Categoría</label>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="rounded-lg border border-asfion-borderSoft bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-asfion-orange"
            >
              <option value="todas">Todas</option>
              {categoriaOpts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-asfion-muted">Etapa</label>
            <div className="flex gap-1 bg-asfion-borderSoft/40 rounded-lg p-0.5">
              {ETAPAS.map(e => (
                <button
                  key={e.key}
                  onClick={() => setEtapa(e.key)}
                  title={e.hint}
                  className={
                    'flex-1 text-xs font-semibold px-2 py-1.5 rounded-md transition ' +
                    (etapa === e.key
                      ? 'bg-asfion-navyDeep text-white shadow-sm'
                      : 'text-asfion-muted hover:text-asfion-navyDeep')
                  }
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {hayFiltrosActivos && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={limpiarFiltros}
              className="text-xs font-semibold text-asfion-terracota hover:underline"
            >
              Limpiar filtros ×
            </button>
          </div>
        )}
      </Card>

      {/* ─────────────────────────────────────────────────────────────────
          GLOBITOS (KPIs) — cambian según la etapa
          Base (siempre): Ciclos · Cabezas · Has · Kg/Cab · Kg Totales · Carga
          Solo Control/Final/Todas: Kg prod/animal · GDPV · Kg prod/Ha · Días
          ────────────────────────────────────────────────────────────── */}
      {/* 5+5 en lg (antes 6+4) — con 6 cards de ~190px el "KG TOTALES" de
          9+ chars (ej "2.447.534") no entraba ni a text-3xl. A 5 cols los
          cards son ~230px y el número se ve entero. Conceptualmente:
          Fila 1 = estado del rodeo · Fila 2 = carga + productividad. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <Kpi
          label="Ciclos"
          value={formatNumber(kpis.ciclos)}
          icon={<CircleDotIcon className="w-4 h-4" />}
          accent="navy"
          sublabel={`${kpis.cControl} con control · ${kpis.cClosed} cerrados`}
        />
        <Kpi
          label="Cabezas"
          value={formatNumber(kpis.cabezas)}
          icon={<UsersIcon className="w-4 h-4" />}
          accent="orange"
        />
        <Kpi
          label="Has Circuito"
          value={formatNumber(Math.round(kpis.hasTot))}
          icon={<LandPlotIcon className="w-4 h-4" />}
          accent="navy"
        />
        <Kpi
          label="Kg / Cab"
          value={formatNumber(Math.round(kpis.kgPorCab))}
          icon={<ScaleIcon className="w-4 h-4" />}
          accent="navy"
          sublabel={
            etapa === 'largada' ? 'al ingreso' :
            etapa === 'control' ? 'al control' :
            etapa === 'final'   ? 'al cierre'  :
                                  'última disponible'
          }
        />
        <Kpi
          label="Kg Totales"
          value={formatNumber(Math.round(kpis.kgTot))}
          icon={<WeightIcon className="w-4 h-4" />}
          accent="terracota"
        />
      </div>

      {/* Segunda fila — Carga + productividad. Carga siempre se muestra
          (incluso en etapa='largada'). Los 4 tiles de productividad caen
          a "—" en largada, sin esconder la fila entera, para mantener el
          layout estable cuando el usuario cambia de etapa. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <Kpi
          label="Carga Ca/Ha"
          value={kpis.cargaCaHa > 0 ? kpis.cargaCaHa.toFixed(2) : '—'}
          icon={<ActivityIcon className="w-4 h-4" />}
          accent="navy"
          sublabel={`${formatNumber(Math.round(kpis.cargaKgHa))} kg/ha`}
        />
        <Kpi
          label="Kg producidos / animal"
          value={etapa === 'largada' ? '—' : (kpis.kgProdPorAnim > 0 ? formatNumber(Math.round(kpis.kgProdPorAnim)) : '—')}
          icon={<TrendingUpIcon className="w-4 h-4" />}
          accent="orange"
          sublabel={etapa === 'largada' ? 'sin datos en largada' : 'kg ganados por cabeza'}
        />
        <Kpi
          label="GDPV"
          value={etapa === 'largada' ? '—' : (kpis.gdpv > 0 ? kpis.gdpv.toFixed(2) : '—')}
          icon={<TrendingUpIcon className="w-4 h-4" />}
          accent="navy"
          sublabel={etapa === 'largada' ? 'sin datos en largada' : 'kg/día/cab (ponderado)'}
        />
        <Kpi
          label="Kg producidos / Ha"
          value={etapa === 'largada' ? '—' : (kpis.kgProdPorHa > 0 ? formatNumber(Math.round(kpis.kgProdPorHa)) : '—')}
          icon={<LandPlotIcon className="w-4 h-4" />}
          accent="terracota"
        />
        <Kpi
          label="Días pastoreo"
          value={etapa === 'largada' ? '—' : (kpis.diasProm > 0 ? formatNumber(Math.round(kpis.diasProm)) : '—')}
          icon={<CalendarDaysIcon className="w-4 h-4" />}
          accent="navy"
          sublabel={etapa === 'largada' ? '' : 'promedio ponderado'}
        />
      </div>
      {/* ─────────────────────────────────────────────────────────────────
          CHARTS
          ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Cabezas por campo">
          {porCampo.length === 0 ? (
            <div className="text-sm text-asfion-muted py-8 text-center">Sin datos para los filtros actuales</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(260, porCampo.length * 40)}>
              <BarChart data={porCampo} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tickFormatter={v => formatNumber(v)} />
                <YAxis type="category" dataKey="nombre" width={100} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatNumber(v)} />
                <Bar dataKey="cabezas" radius={[0, 6, 6, 0]}>
                  {porCampo.map((_, i) => (
                    <Cell key={i} fill={['#1E3A5F','#E07B3F','#C46B5F','#2F5179','#A45B4F'][i % 5]} />
                  ))}
                  <LabelList dataKey="cabezas" position="right" formatter={(v: number) => formatNumber(v)} fontSize={11} fill="#1E3A5F" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Kg producidos / Ha por circuito (top 10)">
          {porCircuito.length === 0 ? (
            <div className="text-sm text-asfion-muted py-8 text-center">Sin datos productivos para los filtros actuales</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(260, porCircuito.length * 32)}>
              <BarChart data={porCircuito} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tickFormatter={v => `${formatNumber(Math.round(v))}`} />
                <YAxis type="category" dataKey="nombre" width={170} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${formatNumber(Math.round(v))} kg/Ha`} />
                <Bar dataKey="kgPorHa" fill="#E07B3F" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="kgPorHa" position="right" formatter={(v: number) => formatNumber(Math.round(v))} fontSize={11} fill="#1E3A5F" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          Tabla de ciclos filtrados
          ────────────────────────────────────────────────────────────── */}
      <Card title={`Ciclos filtrados (${filtrados.length})`}>
        <div className="overflow-x-auto -mx-2">
          <table className="min-w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-asfion-muted bg-asfion-borderSoft/40">
              <tr>
                <th className="text-left px-3 py-2">Campo</th>
                <th className="text-left px-3 py-2">Circuito</th>
                <th className="text-left px-3 py-2">Categoría</th>
                <th className="text-right px-3 py-2">Has</th>
                <th className="text-right px-3 py-2">Cabezas</th>
                <th className="text-right px-3 py-2">Largada</th>
                <th className="text-right px-3 py-2">Control</th>
                <th className="text-right px-3 py-2">Final</th>
                <th className="text-right px-3 py-2">GDPV</th>
                <th className="text-right px-3 py-2">Kg/Anim</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={10} className="text-center text-asfion-muted py-6">Sin ciclos para los filtros aplicados.</td></tr>
              )}
              {filtrados.map(c => {
                const gdpv = c.gdpvFinal ?? c.gdpvControl;
                const kgAnim = c.kgCarneProducidosAnimalFinal ?? c.kgCarneProducidosAnimalControl;
                return (
                  <tr key={c.id} className="border-t border-asfion-borderSoft/60 hover:bg-asfion-orangeSoft/15">
                    <td className="px-3 py-2 font-medium">{c.campoNombre}</td>
                    <td className="px-3 py-2">{c.circuitoNombre}</td>
                    <td className="px-3 py-2 text-xs">{c.categoria}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.hasCircuito ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(c.cantAnimales ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-asfion-muted">
                      {c.kgNetoIngresoDesbaste ? Math.round(c.kgNetoIngresoDesbaste) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-asfion-muted">
                      {c.kgNetoControl ? Math.round(c.kgNetoControl) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {c.kgNetoFinal ? Math.round(c.kgNetoFinal) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{gdpv ? gdpv.toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{kgAnim ? Math.round(kgAnim) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Stays históricos (modelo viejo) — para no perder data cargada por
          la app móvil antes del rediseño. Embebido = sin PageHeader propio. */}
      <PastoreoEntradasView pastoreo={pastoreo} campos={campos} circuitos={circuitos} embedded />
    </div>
  );
}
