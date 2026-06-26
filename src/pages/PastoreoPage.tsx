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
  Area,
  AreaChart,
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
  enPeriodo,
  añosEnData,
  type SimpleFiltros,
} from '@/components/SimpleFilterBar';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { PageHeader } from '@/components/PageHeader';
import { EmptyModule } from '@/components/EmptyModule';
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
    return pastoreo.filter(p => {
      if (!enPeriodo(p.fecha, filtros)) return false;
      if (filtros.campoId !== 'todos' && p.campoId !== filtros.campoId) return false;
      return true;
    });
  }, [pastoreo, filtros]);

  const añosDisponibles = useMemo(
    () => añosEnData(pastoreo.map(p => p.fecha)),
    [pastoreo],
  );

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
    // Carga Animal = cabezas/ha (réplica del Power BI de Agus).
    // Distinta de "Carga (kg/ha)" que mide peso vivo por hectárea.
    // Carga Animal es la métrica más estándar en ganadería argentina —
    // sirve para evaluar sobrepastoreo / capacidad de la parcela.
    const cargaAnimal = hectareas > 0 ? animalesTotal / hectareas : 0;
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
      cargaAnimal,
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

  // ---------- Kg por Circuito stacked por categoría animal ----------
  // Replica del Power BI página 3: barras verticales con X = circuito,
  // stacked por Novillitos / Vaquillas / Otros. Mapeo: cualquier categoría
  // que empiece con "Novillito" cae en Novillitos, las que empiezan con
  // "Vaquilla" caen en Vaquillas, el resto va a Otros (toros, etc.).
  const kgPorCircuitoStacked = useMemo(() => {
    const map = new Map<string, { circuito: string; Novillitos: number; Vaquillas: number; Otros: number; total: number }>();
    filtrados.forEach(p => {
      if (p.animales == null || p.kgPromedio == null) return;
      const cir = circuitoMap.get(p.circuitoId);
      const cirName = cir?.nombre ?? p.circuitoId;
      const entry = map.get(p.circuitoId) ?? {
        circuito: cirName,
        Novillitos: 0,
        Vaquillas: 0,
        Otros: 0,
        total: 0,
      };
      const kg = p.animales * p.kgPromedio;
      const cat = (p.categoria || '').toLowerCase();
      if (cat.startsWith('novillito') || cat.startsWith('novillo'))      entry.Novillitos += kg;
      else if (cat.startsWith('vaquilla') || cat.startsWith('vaq'))      entry.Vaquillas  += kg;
      else                                                                entry.Otros      += kg;
      entry.total += kg;
      map.set(p.circuitoId, entry);
    });
    return [...map.values()]
      .map(e => ({
        circuito: e.circuito,
        Novillitos: Math.round(e.Novillitos),
        Vaquillas:  Math.round(e.Vaquillas),
        Otros:      Math.round(e.Otros),
        total:      Math.round(e.total),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [filtrados, circuitoMap]);

  // ---------- KPIs de Entradas (réplica Power BI página 5) ----------
  // Calculados sobre el scope filtrado completo: peso promedio (weighted
  // por animales), fecha ponderada (weighted por animales × kg), categoría
  // modal (la que más se repite), carga promedio (kg/ha promedio entre
  // entradas con kg cargado).
  const entradasKpis = useMemo(() => {
    let sumAnimales = 0;
    let sumPesoXanimales = 0;     // Σ peso × animales
    let sumPesoXdiaXanimales = 0; // Σ (epochMs × animales) para weighted avg date
    let kgTotalesGlobal = 0;
    const catCounts: Record<string, number> = {};
    let sumCargaPorEntrada = 0;
    let nCargaEntradas = 0;
    const seenCirHa = new Map<string, number>();

    filtrados.forEach(p => {
      const animales = p.animales ?? 0;
      const kgProm = p.kgPromedio ?? 0;
      if (animales > 0 && kgProm > 0) {
        sumAnimales += animales;
        sumPesoXanimales += kgProm * animales;
        kgTotalesGlobal += animales * kgProm;

        const ent = Date.parse(p.fecha);
        if (Number.isFinite(ent)) sumPesoXdiaXanimales += ent * animales;

        // Carga aproximada por esta entrada: kg de la entrada / has del circuito.
        const cir = circuitoMap.get(p.circuitoId);
        const has = cir?.hectareas ?? 0;
        if (has > 0) {
          sumCargaPorEntrada += (animales * kgProm) / has;
          nCargaEntradas++;
          seenCirHa.set(p.circuitoId, has);
        }
      }
      const cat = (p.categoria || '').trim();
      if (cat) catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    });

    const pesoPromedio = sumAnimales > 0 ? sumPesoXanimales / sumAnimales : 0;
    const fechaPonderadaIso = sumAnimales > 0
      ? new Date(sumPesoXdiaXanimales / sumAnimales).toISOString().slice(0, 10)
      : null;
    const categoriaModal = Object.entries(catCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
    const cargaPromedio = nCargaEntradas > 0 ? sumCargaPorEntrada / nCargaEntradas : 0;

    return {
      animalesTotales: sumAnimales,
      pesoPromedio,
      fechaPonderadaIso,
      categoriaModal,
      cargaPromedio,
      kgTotales: kgTotalesGlobal,
    };
  }, [filtrados, circuitoMap]);

  // ---------- Kg Totales por Momento de Largada (decena) ----------
  // Replica el chart del Power BI del cliente: agrupa kg totales de las
  // entradas según en qué decena del mes ocurrió la fecha_entrada.
  //   - Primer Decena: días 1-10
  //   - Segunda Decena: días 11-20
  //   - Tercer Decena: días 21-31
  // Sirve para ver si las entradas se concentran al inicio, medio o final
  // de cada mes — útil para planificar logística de transporte y carga.
  const porDecena = useMemo(() => {
    const buckets: Record<'Primer Decena' | 'Segunda Decena' | 'Tercer Decena', number> = {
      'Primer Decena': 0,
      'Segunda Decena': 0,
      'Tercer Decena': 0,
    };
    filtrados.forEach(p => {
      if (p.animales == null || p.kgPromedio == null) return;
      const dia = Number((p.fecha ?? '').slice(8, 10));
      if (!Number.isFinite(dia)) return;
      const kg = p.animales * p.kgPromedio;
      if (dia <= 10) buckets['Primer Decena'] += kg;
      else if (dia <= 20) buckets['Segunda Decena'] += kg;
      else buckets['Tercer Decena'] += kg;
    });
    return [
      { decena: 'Primer Decena',  kg: Math.round(buckets['Primer Decena']) },
      { decena: 'Segunda Decena', kg: Math.round(buckets['Segunda Decena']) },
      { decena: 'Tercer Decena',  kg: Math.round(buckets['Tercer Decena']) },
    ];
  }, [filtrados]);

  // ---------- Resumen de entradas por circuito (replica tabla "Entradas - Aguisot") ----------
  // Para cada circuito muestra cantidad de entradas, fecha ponderada de
  // entrada (weighted avg por animales*kg), categoría dominante, animales
  // totales y kg totales. Muy útil para tomar decisión de qué circuito
  // recibió más carga este mes y cuándo.
  const entradasPorCircuito = useMemo(() => {
    const map = new Map<string, {
      circuitoId: string;
      circuito: string;
      campo: string;
      cantidad: number;
      animalesTotales: number;
      kgTotales: number;
      sumPesoXdia: number;       // Σ (animales × día desde epoch) para la weighted avg
      sumAnimales: number;
      catCounts: Record<string, number>;
    }>();
    filtrados.forEach(p => {
      const cir = circuitoMap.get(p.circuitoId);
      const campoNombre = cir
        ? (campos.find(c => c.id === cir.campoId)?.nombre ?? '')
        : '';
      const entry = map.get(p.circuitoId) ?? {
        circuitoId: p.circuitoId,
        circuito: cir?.nombre ?? p.circuitoId,
        campo: campoNombre,
        cantidad: 0,
        animalesTotales: 0,
        kgTotales: 0,
        sumPesoXdia: 0,
        sumAnimales: 0,
        catCounts: {},
      };
      entry.cantidad++;
      const animales = p.animales ?? 0;
      const kgProm = p.kgPromedio ?? 0;
      entry.animalesTotales += animales;
      entry.kgTotales += animales * kgProm;
      // Weighted avg date: pesamos por animales
      const ent = Date.parse(p.fecha);
      if (Number.isFinite(ent) && animales > 0) {
        entry.sumPesoXdia += ent * animales;
        entry.sumAnimales += animales;
      }
      const cat = p.categoria || 'Sin categoría';
      entry.catCounts[cat] = (entry.catCounts[cat] ?? 0) + 1;
      map.set(p.circuitoId, entry);
    });
    return [...map.values()]
      .map(e => {
        const fechaPond = e.sumAnimales > 0
          ? new Date(e.sumPesoXdia / e.sumAnimales).toISOString().slice(0, 10)
          : '—';
        const categoriaDom = Object.entries(e.catCounts)
          .sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—';
        const pesoPromedio = e.animalesTotales > 0 ? e.kgTotales / e.animalesTotales : 0;
        return {
          ...e,
          fechaPond,
          categoriaDom,
          pesoPromedio: Math.round(pesoPromedio * 100) / 100,
          kgTotales: Math.round(e.kgTotales),
        };
      })
      .sort((a, b) => b.kgTotales - a.kgTotales);
  }, [filtrados, circuitoMap, campos]);

  // ---------- Resumen Materia Seca (placeholder hasta definir fuente) ----------
  // La data de MS hoy vive en Google Sheets (cargado por el ingeniero).
  // Cuando definamos Ruta A/B, esto enchufa con datos reales. Por ahora
  // mostramos la UI con empty state.
  const materiaSeca = useMemo(() => ({
    msKgPorHa: 0,
    msTotal: 0,
    hectareas: 0,
    porCircuito: [] as Array<{ circuito: string; ms: number }>,
    serieTiempo: [] as Array<{ fecha: string; msTotal: number; consumoMs: number }>,
    tabla: [] as Array<{ circuito: string; parcelas: number; msTotal: number; has: number; consumoMs: number; msRemanente: number }>,
    hasData: false,
  }), []);

  if (pastoreo.length === 0) {
    return <EmptyModule label="movimientos de pastoreo" genero="masc" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pastoreo"
        subtitle="Movimientos de animales entre parcelas — entrada, salida y ocupación actual."
        count={{ value: filtrados.length, label: 'movimientos' }}
        lastDate={filtrados[0]?.fecha}
        actions={
          <ExportCsvButton
            onClick={() => exportPastoreo(filtrados, campos, circuitos)}
            disabled={filtrados.length === 0}
            count={filtrados.length}
          />
        }
      />

      <SimpleFilterBar filtros={filtros} campos={campos} onChange={setFiltros} añosDisponibles={añosDisponibles} />

      {/* KPIs productivos — fila Power BI estilo */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Kpi
          label="Animales"
          value={kpis.animalesTotal > 0 ? formatNumber(kpis.animalesTotal) : '—'}
          sublabel="Cabezas en movimientos"
          accent="orange"
          icon={<UsersIcon size={18} />}
        />
        <Kpi
          label="Has Circuito"
          value={kpis.hectareas > 0 ? formatNumber(kpis.hectareas) : '—'}
          sublabel="Hectáreas activas"
          accent="navy"
          icon={<LandPlotIcon size={18} />}
        />
        <Kpi
          label="KG/Cab"
          value={kpis.kgPorCab > 0 ? kpis.kgPorCab.toFixed(2) : '—'}
          sublabel={`Prom. en ${formatNumber(kpis.nConKg)} stays`}
          accent="navy"
          icon={<ScaleIcon size={18} />}
        />
        <Kpi
          label="Kg Totales"
          value={kpis.kgTotales > 0 ? formatNumber(Math.round(kpis.kgTotales)) : '—'}
          sublabel="Σ (animales × kg/cab)"
          accent="navy"
          icon={<WeightIcon size={18} />}
        />
        <Kpi
          label="Carga (kg/ha)"
          value={kpis.carga > 0 ? kpis.carga.toFixed(2) : '—'}
          sublabel="Kg Totales / Has"
          accent="terracota"
          icon={<LandPlotIcon size={18} />}
        />
        <Kpi
          label="Carga Animal"
          value={kpis.cargaAnimal > 0 ? kpis.cargaAnimal.toFixed(2) : '—'}
          sublabel="Cabezas / Ha"
          accent="terracota"
          icon={<UsersIcon size={18} />}
        />
      </div>

      {/* KPIs operativos — fila secundaria */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label="Total movimientos"
          value={formatNumber(kpis.total)}
          sublabel={`${formatNumber(kpis.cerrados)} cerrados`}
          accent="navy"
          icon={<ActivityIcon size={18} />}
        />
        <Kpi
          label="Stays abiertos"
          value={formatNumber(kpis.abiertos)}
          sublabel={`${formatNumber(kpis.parcelasEnUso)} parcelas en uso`}
          accent="orange"
          icon={<MapPinIcon size={18} />}
        />
        <Kpi
          label="Circuitos activos"
          value={formatNumber(kpis.circuitosActivos)}
          accent="navy"
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
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" horizontal={false} />
            <XAxis type="number" stroke="#6B7280" fontSize={12} allowDecimals={false} />
            <YAxis type="category" dataKey="label" stroke="#6B7280" fontSize={11} width={180} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
            <Bar dataKey="total" name="Movimientos" fill="#163349" radius={[0, 0, 0, 0]}>
              <LabelList dataKey="total" position="right" fontSize={11} fill="#163349" />
            </Bar>
            <Bar dataKey="abiertos" name="Abiertos" fill="#FF8409" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Por categoría animal" subtitle="Animales que más se rotan">
        <ResponsiveContainer width="100%" height={Math.max(280, porCategoria.length * 32)}>
          <BarChart data={porCategoria} layout="vertical" margin={{ top: 8, right: 60, left: 30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" horizontal={false} />
            <XAxis type="number" stroke="#6B7280" fontSize={12} allowDecimals={false} />
            <YAxis type="category" dataKey="categoria" stroke="#6B7280" fontSize={11} width={140} />
            <Tooltip />
            <Bar dataKey="n" radius={[0, 4, 4, 0]}>
              {porCategoria.map((_, i) => <Cell key={i} fill="#FF8409" />)}
              <LabelList dataKey="n" position="right" fontSize={11} fill="#163349" />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
              <XAxis dataKey="categoria" stroke="#6B7280" fontSize={11} angle={-15} textAnchor="end" height={60} interval={0} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip formatter={(v: number) => [`${formatNumber(v)} kg`, 'Total']} />
              <Bar dataKey="kg" name="Kg Totales" fill="#163349" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="kg" position="top" fontSize={11} fill="#163349" formatter={(v: number) => formatNumber(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Kg Totales por Circuito stacked por categoría animal (Novillitos
          verde + Vaquillas azul). Réplica fiel del chart "Kg Totales por
          Categoría" del Power BI página 3 — el que está a la derecha de
          "Animales por Campo y Circuito". */}
      {kgPorCircuitoStacked.length > 0 && (
        <Card
          title="Kg Totales por Circuito"
          subtitle="Stacked por categoría animal — Novillitos / Vaquillas / Otros"
        >
          <ResponsiveContainer width="100%" height={Math.max(300, kgPorCircuitoStacked.length * 32)}>
            <BarChart data={kgPorCircuitoStacked} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
              <XAxis dataKey="circuito" stroke="#6B7280" fontSize={11} />
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${formatNumber(v)} kg`, '']} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
              <Bar dataKey="Novillitos" stackId="cat" fill="#163349" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Vaquillas"  stackId="cat" fill="#6B9DBE" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Otros"      stackId="cat" fill="#FFCB95" radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="total"
                  position="top"
                  fontSize={11}
                  fill="#163349"
                  formatter={(v: number) =>
                    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M`
                    : v >= 1_000   ? `${(v / 1_000).toFixed(0)}k`
                    : formatNumber(v)
                  }
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* KPIs específicos del scope Entradas — réplica de los 6 KPIs de la
          página 5 del Power BI ("Entradas — Aguisot"). Calculados sobre el
          mismo filtrado actual. */}
      {entradasKpis.animalesTotales > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi
            label="Animales Totales"
            value={formatNumber(entradasKpis.animalesTotales)}
            accent="navy"
          />
          <Kpi
            label="Peso Promedio"
            value={entradasKpis.pesoPromedio.toFixed(2)}
            accent="navy"
          />
          <Kpi
            label="Fecha Ponderada"
            value={entradasKpis.fechaPonderadaIso ?? '—'}
            accent="orange"
          />
          <Kpi
            label="Categoría modal"
            value={entradasKpis.categoriaModal ?? '—'}
            accent="navy"
          />
          <Kpi
            label="Carga prom (kg/ha)"
            value={entradasKpis.cargaPromedio.toFixed(2)}
            accent="terracota"
          />
          <Kpi
            label="Kg Totales"
            value={formatNumber(Math.round(entradasKpis.kgTotales))}
            accent="orange"
          />
        </div>
      )}

      {/* Kg Totales por Momento de Largada — réplica del Power BI página 5.
          Sirve para entender concentración temporal de entradas en el mes. */}
      {(porDecena[0]?.kg ?? 0) + (porDecena[1]?.kg ?? 0) + (porDecena[2]?.kg ?? 0) > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card
            title="Kg Totales por Momento de Largada"
            subtitle="Distribución de kg entrantes según decena del mes"
            className="lg:col-span-1"
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porDecena} margin={{ top: 24, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
                <XAxis dataKey="decena" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`${formatNumber(v)} kg`, 'Total']} />
                <Bar dataKey="kg" name="Kg Totales" fill="#FF8409" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="kg"
                    position="top"
                    fontSize={11}
                    fill="#163349"
                    formatter={(v: number) =>
                      v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M`
                      : v >= 1_000     ? `${(v / 1_000).toFixed(0)}k`
                      : formatNumber(v)
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Resumen entradas por circuito — réplica de la tabla "Entradas — Aguisot". */}
          <Card
            title="Entradas por circuito"
            subtitle="Fecha ponderada, peso promedio y kg totales"
            className="lg:col-span-2"
          >
            <EntradasPorCircuitoTabla rows={entradasPorCircuito} />
          </Card>
        </div>
      )}

      {/* Sección Materia Seca — réplica de la página 4 del Power BI.
          Los datos de MS hoy viven en Google Sheets (carga del ingeniero).
          La UI está armada y enchufa cuando definamos la fuente (Ruta A: app
          móvil con form propio · Ruta B: sync periódico de Sheets). */}
      <MateriaSecaSection data={materiaSeca} />

      {/* Tabla detalle — replica el "Campo / Fecha Entrada / Circuito / Has /
          Kg Promedio / Animales" del Power BI. */}
      <Card title="Detalle de movimientos" subtitle="Últimos 50 — ordenados por fecha de entrada">
        <DetalleTabla rows={filtrados.slice(0, 50)} campos={campos} circuitos={circuitos} />
      </Card>
    </div>
  );
}

// === Tabla de entradas agregadas por circuito (réplica Power BI página 5) ===
function EntradasPorCircuitoTabla({
  rows,
}: {
  rows: Array<{
    circuito: string;
    campo: string;
    cantidad: number;
    fechaPond: string;
    categoriaDom: string;
    animalesTotales: number;
    pesoPromedio: number;
    kgTotales: number;
  }>;
}) {
  if (rows.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-asfion-muted">
        Sin entradas en el período.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
            <th className="py-2 px-2 font-semibold">Circuito</th>
            <th className="py-2 px-2 font-semibold tabular-nums">Entradas</th>
            <th className="py-2 px-2 font-semibold">Fecha pond.</th>
            <th className="py-2 px-2 font-semibold">Categoría</th>
            <th className="py-2 px-2 font-semibold tabular-nums">Animales</th>
            <th className="py-2 px-2 font-semibold tabular-nums">Peso prom.</th>
            <th className="py-2 px-2 font-semibold tabular-nums">Kg totales</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map(r => (
            <tr key={r.circuito} className="border-b border-asfion-borderSoft/50 hover:bg-asfion-bg/60 transition">
              <td className="py-2 px-2 font-semibold text-asfion-navyDeep">
                {r.circuito}
                {r.campo && <span className="text-xs text-asfion-muted ml-1">({r.campo})</span>}
              </td>
              <td className="py-2 px-2 tabular-nums text-asfion-navy">{r.cantidad}</td>
              <td className="py-2 px-2 tabular-nums text-asfion-muted">{r.fechaPond}</td>
              <td className="py-2 px-2 text-asfion-muted">{r.categoriaDom}</td>
              <td className="py-2 px-2 tabular-nums text-asfion-navy">{r.animalesTotales}</td>
              <td className="py-2 px-2 tabular-nums text-asfion-muted">{r.pesoPromedio.toFixed(2)}</td>
              <td className="py-2 px-2 tabular-nums font-semibold text-asfion-navyDeep">
                {r.kgTotales.toLocaleString('es-AR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// === Sección Materia Seca (réplica Power BI página 4) ===
// Hoy UI lista pero sin data — empty state. Cuando se enchufe la fuente
// (Sheets sync o input desde la app), recibe el objeto data con los
// arrays poblados y todo renderea automático.
interface MateriaSecaData {
  msKgPorHa: number;
  msTotal: number;
  hectareas: number;
  porCircuito: Array<{ circuito: string; ms: number }>;
  serieTiempo: Array<{ fecha: string; msTotal: number; consumoMs: number }>;
  tabla: Array<{ circuito: string; parcelas: number; msTotal: number; has: number; consumoMs: number; msRemanente: number }>;
  hasData: boolean;
}

function MateriaSecaSection({ data }: { data: MateriaSecaData }) {
  if (!data.hasData) {
    return (
      <Card
        title="Materia Seca"
        subtitle="MS Total, kg/ha promedio, consumo y remanente por circuito · réplica de Power BI"
      >
        <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-center px-6">
          <p className="text-sm font-semibold text-asfion-navy">
            Todavía no hay mediciones de materia seca cargadas.
          </p>
          <p className="text-xs text-asfion-muted max-w-md">
            Cuando se enchufe la fuente de datos (app móvil con form de medición
            o sync periódico de Google Sheets), acá vas a ver KPIs, chart por
            circuito, evolución MS Total vs Consumo en el tiempo, y tabla con
            MS Remanente por parcela.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="MS kg/ha Prom" value={formatNumber(data.msKgPorHa)} accent="navy" />
        <Kpi label="MS Total"      value={formatNumber(data.msTotal)}   accent="orange" />
        <Kpi label="Hectáreas"     value={formatNumber(data.hectareas)} accent="navy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Materia Seca por Circuito" subtitle="Total MS disponible por circuito">
          <ResponsiveContainer width="100%" height={Math.max(280, data.porCircuito.length * 32)}>
            <BarChart data={data.porCircuito} layout="vertical" margin={{ top: 8, right: 60, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" horizontal={false} />
              <XAxis type="number" stroke="#6B7280" fontSize={12} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`} />
              <YAxis type="category" dataKey="circuito" stroke="#6B7280" fontSize={11} width={120} />
              <Tooltip formatter={(v: number) => [`${formatNumber(v)} kg`, 'MS Total']} />
              <Bar dataKey="ms" name="MS Total" fill="#FF8409" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="ms" position="right" fontSize={11} fill="#163349"
                  formatter={(v: number) =>
                    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000   ? `${(v / 1_000).toFixed(0)}k`
                    : formatNumber(v)
                  }
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Evolución MS Total + Consumo por Mes/Día — réplica del área
            chart del Power BI página 4. Verde = MS disponible, navy =
            consumido por la hacienda. Útil para ver si el consumo está
            "comiendo" el remanente o si la curva de MS sigue creciendo. */}
        <Card title="MS Total y Consumo" subtitle="Evolución en el tiempo">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.serieTiempo} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gMsTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FF8409" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#FF8409" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gMsConsumo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#163349" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#163349" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
              <XAxis dataKey="fecha" stroke="#6B7280" fontSize={11} />
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`} />
              <Tooltip formatter={(v: number) => [`${formatNumber(v)} kg`, '']} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
              <Area type="monotone" dataKey="msTotal"   name="MS Total"   stroke="#FF8409" strokeWidth={2.5} fill="url(#gMsTotal)"   dot={false} />
              <Area type="monotone" dataKey="consumoMs" name="Consumo MS" stroke="#163349" strokeWidth={2}   fill="url(#gMsConsumo)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tabla detalle MS — réplica de la tabla de la página 4. Una row
          por circuito con parcelas, MS Total, has, Consumo MS y MS Remanente. */}
      <Card title="Detalle por circuito" subtitle="Parcelas, MS Total, Consumo y MS Remanente">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
                <th className="py-2 px-2 font-semibold">Circuito</th>
                <th className="py-2 px-2 font-semibold tabular-nums">Parcelas</th>
                <th className="py-2 px-2 font-semibold tabular-nums">MS Total</th>
                <th className="py-2 px-2 font-semibold tabular-nums">Has</th>
                <th className="py-2 px-2 font-semibold tabular-nums">Consumo MS (kg)</th>
                <th className="py-2 px-2 font-semibold tabular-nums">MS Remanente</th>
              </tr>
            </thead>
            <tbody>
              {data.tabla.map(r => (
                <tr key={r.circuito} className="border-b border-asfion-borderSoft/50 hover:bg-asfion-bg/60 transition">
                  <td className="py-2 px-2 font-semibold text-asfion-navyDeep">{r.circuito}</td>
                  <td className="py-2 px-2 tabular-nums text-asfion-navy">{r.parcelas}</td>
                  <td className="py-2 px-2 tabular-nums text-asfion-navy">{formatNumber(r.msTotal)}</td>
                  <td className="py-2 px-2 tabular-nums text-asfion-muted">{r.has}</td>
                  <td className="py-2 px-2 tabular-nums text-asfion-muted">{r.consumoMs.toLocaleString('es-AR')}</td>
                  <td className="py-2 px-2 tabular-nums font-semibold text-asfion-orange">
                    {r.msRemanente.toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
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
            {/* Kg Promedio y Animales — réplica de las columnas del Power BI
                página 3 que faltaban (mostraban kg/cab y animales por entrada). */}
            <th className="text-right font-semibold py-2 pr-3">Kg Prom</th>
            <th className="text-right font-semibold py-2 pr-3">Animales</th>
            <th className="text-left font-semibold py-2 pr-3">Caravana</th>
            <th className="text-left font-semibold py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-asfion-borderSoft/50">
              <td className="py-2 pr-3 font-semibold text-asfion-navy">{campoNombre(r.campoId)}</td>
              <td className="py-2 pr-3 tabular-nums text-asfion-navy">{r.fecha}</td>
              <td className="py-2 pr-3 tabular-nums text-asfion-muted">{r.fechaSalida ?? '—'}</td>
              <td className="py-2 pr-3 text-asfion-navy">{circuitoNombre(r.circuitoId)}</td>
              <td className="py-2 pr-3 tabular-nums text-right text-asfion-muted">
                {circuitoHas(r.circuitoId)?.toFixed(0) ?? '—'}
              </td>
              <td className="py-2 pr-3 text-asfion-navy">{r.categoria}</td>
              <td className="py-2 pr-3 tabular-nums text-right text-asfion-muted">
                {r.kgPromedio != null ? r.kgPromedio.toFixed(2) : '—'}
              </td>
              <td className="py-2 pr-3 tabular-nums text-right text-asfion-navy font-semibold">
                {r.animales ?? '—'}
              </td>
              <td className="py-2 pr-3 text-asfion-muted">{r.caravanaNumero ?? '—'}</td>
              <td className="py-2">
                {r.fechaSalida ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-asfion-borderSoft text-asfion-muted">
                    Cerrado
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-asfion-orange/20 text-asfion-navy">
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

