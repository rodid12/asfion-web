// Página del módulo Pariciones — versión "Power BI" pedida por el cliente.
//
// Estructura (de arriba abajo):
//   1. Header con título y export CSV.
//   2. FilterBar (rango, campo, evento).
//   3. 7 KPIs en grid: Stock Base · Eventos · Nacimientos · Muertes · Vacas sin Parir · Ternero en Pie · Asistencia(Si).
//   4. Fila de 5 % de eficiencia (MiniKpi compactos).
//   5. Charts row A: donut Eventos · donut Nacimientos segmentados (cabeza/cuerpo/cola).
//   6. Causa de Muerte (bar chart vertical) y Evolución mensual.
//   7. Por campo (stacked) + Por grupo (segmentación por fecha).
//   8. Tabla detalle con Export CSV.
//
// Fórmulas (replican el DAX del Power BI del cliente):
//   Stock Base       = sum(campos.stock_inicial_vacas) sobre los campos visibles
//   Nacimientos      = count eventos tipo Nacimiento
//   Muertes          = count eventos tipo Muerte
//   Abortos          = count eventos tipo Aborto
//   Retactos         = count eventos tipo Retacto
//   Eventos          = filtrados.length
//   Muerte Señalado  = count pariciones con causaTipo = "Muerte Señalado"
//   Nacido Muerto    = count pariciones con causaTipo = "Nacido Muerto"
//   Ternero en Pie   = Nacimientos - Muerte Señalado
//   Vacas sin Parir  = Stock Base - Nacimientos - Retactos
//   Orejanos         = count pariciones con sexo = "Orejano"
//   Asistencia(Si)   = count Nacimientos con asistencia = "Si"
//
//   % Destete        = Ternero en Pie / Stock Base
//   % Abortos        = Abortos / Stock Base
//   % Muerte Señalado = Muerte Señalado / Nacimientos
//   % Nacido Muerto  = Nacido Muerto / Nacimientos

import React, { useMemo, useState } from 'react';
import {
  BabyIcon,
  HeartCrackIcon,
  ShieldOffIcon,
  SkullIcon,
  TrendingUpIcon,
  UsersIcon,
  WarehouseIcon,
} from 'lucide-react';
import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import { MiniKpi } from '@/components/MiniKpi';
import { FilterBar } from '@/components/FilterBar';
import { ParicionesTable } from '@/components/ParicionesTable';
import { ParicionesMensuales } from '@/charts/ParicionesMensuales';
import { ParicionesPorCampo } from '@/charts/ParicionesPorCampo';
import { ParicionesPorGrupo } from '@/charts/ParicionesPorGrupo';
import { CausaDeMuertePariciones } from '@/charts/CausaDeMuertePariciones';
import { EventosDonut } from '@/charts/EventosDonut';
import { NacimientosSegmentados } from '@/charts/NacimientosSegmentados';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { PageHeader } from '@/components/PageHeader';
import { EmptyModule } from '@/components/EmptyModule';
import { aplicarFiltros, FILTROS_DEFAULT, type Filtros } from '@/data/filters';
import { formatNumber, formatPercent } from '@/lib/utils';
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';
import type { Campo, Paricion } from '@/data/types';

interface Props {
  pariciones: Paricion[];
  campos: Campo[];
}

export function ParicionesPage({ pariciones, campos }: Props) {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_DEFAULT);

  const filtrados = useMemo(
    () => aplicarFiltros(pariciones, filtros),
    [pariciones, filtros],
  );

  // Años con data — para alimentar el dropdown del filtro.
  const añosDisponibles = useMemo(() => {
    const set = new Set<number>();
    for (const p of pariciones) {
      if (p.fecha && p.fecha.length >= 4) {
        const y = parseInt(p.fecha.slice(0, 4), 10);
        if (Number.isFinite(y) && y > 2000 && y < 2100) set.add(y);
      }
    }
    return [...set].sort((a, b) => b - a);
  }, [pariciones]);

  // Campos visibles según el filtro de campo (1 o todos).
  // El Stock Base se suma sobre los visibles para que cuando el cliente
  // filtre "Picaflor", el denominador sea solo el de Picaflor.
  const camposVisibles = useMemo(() => {
    if (filtros.campoId === 'todos') return campos;
    return campos.filter(c => c.id === filtros.campoId);
  }, [filtros.campoId, campos]);

  const kpis = useMemo(() => {
    const total = filtrados.length;
    // En el modelo de datos hay 4 tipos de evento:
    //   Nacimiento → parto, ternero vivo
    //   Muerte     → parto, ternero murió (también es un parto, contado aparte)
    //   Aborto     → no hubo parto a término
    //   Retacto    → no es parto (re-chequeo)
    //
    // El Power BI del cliente considera "Nacimientos" = TODOS los partos
    // (con o sin muerte del ternero). Por eso el denominador de los % es:
    //
    //   nacimientosTotales = count(Nacimiento) + count(Muerte)
    //
    // Sin esta corrección, % Muerte Señalado en campos con pocos eventos
    // explotaba (ej. Picaflor: 9/2 = 450% — era el bug reportado por Ro).
    const nacimientosVivos = filtrados.filter(p => p.evento === 'Nacimiento').length;
    const muertes          = filtrados.filter(p => p.evento === 'Muerte').length;
    const abortos          = filtrados.filter(p => p.evento === 'Aborto').length;
    const retactos         = filtrados.filter(p => p.evento === 'Retacto').length;

    // "Nacimientos totales" = todos los partos (con o sin muerte del ternero).
    const nacimientos = nacimientosVivos + muertes;

    // Causa de muerte (solo aplica sobre las muertes). Son subconjuntos:
    //   muerteSenalado + nacidoMuerto + (desconocido / sin causa) = muertes
    const muerteSenalado = filtrados.filter(p => p.causaTipo === 'Muerte Señalado').length;
    const nacidoMuerto   = filtrados.filter(p => p.causaTipo === 'Nacido Muerto').length;

    // Ternero en Pie = nacimientos totales - muertes señaladas
    // (los nacidos muertos se cuentan dentro de "Nacimientos" pero en Power BI
    //  no se restan acá — replica la fórmula del cliente).
    const ternerosEnPie = Math.max(0, nacimientos - muerteSenalado);
    const stockBase = camposVisibles.reduce(
      (s, c) => s + (c.stockInicialVacas ?? 0),
      0,
    );
    // Vacas sin Parir = Stock - Nacimientos totales - Retactos
    // (los abortos son vacas que SÍ entraron en gestación, así que cuentan
    //  como "consumieron stock" — están afuera de "sin parir").
    const vacasSinParir = Math.max(0, stockBase - nacimientos - retactos - abortos);

    const orejanos = filtrados.filter(p => (p.sexo ?? '').toLowerCase() === 'orejano').length;
    // Asistencia se considera para CUALQUIER parto (vivo o muerto).
    const asistidos = filtrados.filter(
      p => (p.evento === 'Nacimiento' || p.evento === 'Muerte') && p.asistencia === 'Si',
    ).length;

    return {
      total,
      nacimientosVivos,
      nacimientos,   // ← total de partos (incluye muertes)
      muertes,
      abortos,
      retactos,
      muerteSenalado,
      nacidoMuerto,
      ternerosEnPie,
      stockBase,
      vacasSinParir,
      orejanos,
      asistidos,
      // Porcentajes (las divisiones devuelven 0 si denom = 0)
      // % Parición = Nacimientos Totales (partos) / Stock Base → mide
      //   qué proporción del rodeo parió, incluyendo terneros que después
      //   murieron. Es la métrica del Power BI de Agus.
      // % Destete Parcial = Ternero en Pie / Stock Base → mide qué
      //   proporción del rodeo terminó con un ternero vivo a la fecha.
      //   Es nuestra métrica complementaria (más conservadora).
      pctParicion:      stockBase    ? nacimientos / stockBase : 0,
      pctDestete:       stockBase    ? ternerosEnPie / stockBase : 0,
      pctAbortos:       stockBase    ? abortos / stockBase : 0,
      pctMuerteSenal:   nacimientos  ? muerteSenalado / nacimientos : 0,
      pctNacidoMuerto:  nacimientos  ? nacidoMuerto / nacimientos : 0,
    };
  }, [filtrados, camposVisibles]);

  // Texto del título: si hay un campo seleccionado, lo nombramos (estilo
  // "Pariciones Picaflor" del Power BI). Sino, queda genérico.
  const tituloCampo = filtros.campoId === 'todos'
    ? null
    : (campos.find(c => c.id === filtros.campoId)?.nombre ?? null);

  if (pariciones.length === 0) {
    return <EmptyModule label="pariciones" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pariciones${tituloCampo ? ` · ${tituloCampo}` : ''}`}
        subtitle={
          tituloCampo
            ? `Resumen del campo ${tituloCampo}.`
            : 'Resumen de actividad de parición a través de todos los campos.'
        }
        count={{ value: filtrados.length, label: 'eventos' }}
        lastDate={filtrados[0]?.fecha}
        actions={
          <ExportCsvButton
            onClick={() => exportPariciones(filtrados, campos)}
            disabled={filtrados.length === 0}
            count={filtrados.length}
          />
        }
      />

      <FilterBar filtros={filtros} campos={campos} onChange={setFiltros} añosDisponibles={añosDisponibles} />

      {/* KPIs principales — fila superior con los 4 más importantes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label="Stock Base"
          value={kpis.stockBase > 0 ? formatNumber(kpis.stockBase) : '—'}
          sublabel={kpis.stockBase === 0 ? 'Sin stock cargado' : 'Vacas preñadas al inicio'}
          accent="navy"
          icon={<WarehouseIcon size={18} />}
        />
        <Kpi
          label="Eventos"
          value={formatNumber(kpis.total)}
          sublabel={`${formatNumber(kpis.retactos)} retactos · ${formatNumber(kpis.abortos)} abortos`}
          accent="navy"
          icon={<TrendingUpIcon size={18} />}
        />
        <Kpi
          label="Nacimientos"
          value={formatNumber(kpis.nacimientos)}
          sublabel={`${formatNumber(kpis.nacimientosVivos)} vivos · ${formatNumber(kpis.muertes)} muertos`}
          accent="orange"
          icon={<BabyIcon size={18} />}
        />
        <Kpi
          label="Muertes"
          value={formatNumber(kpis.muertes)}
          sublabel={`${formatNumber(kpis.muerteSenalado)} señaladas · ${formatNumber(kpis.nacidoMuerto)} nac. muertos`}
          accent="terracota"
          icon={<SkullIcon size={18} />}
        />
      </div>

      {/* KPIs derivados — fila inferior */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Kpi
          label="Vacas sin Parir"
          value={kpis.stockBase > 0 ? formatNumber(kpis.vacasSinParir) : '—'}
          sublabel="Stock − Partos − Retactos − Abortos"
          accent="navy"
          icon={<ShieldOffIcon size={18} />}
        />
        <Kpi
          label="Ternero en Pie"
          value={formatNumber(kpis.ternerosEnPie)}
          sublabel="Nacimientos − Muerte Señalado"
          accent="orange"
          icon={<UsersIcon size={18} />}
        />
        <Kpi
          label="Asistencia (Si)"
          value={formatNumber(kpis.asistidos)}
          sublabel={kpis.nacimientos ? `${formatPercent(kpis.asistidos / kpis.nacimientos)} de partos` : ''}
          accent="navy"
          icon={<HeartCrackIcon size={18} />}
        />
      </div>

      {/* Fila de % eficiencia — mini-tiles compactos */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MiniKpi
          label="% Parición"
          value={kpis.stockBase ? formatPercent(kpis.pctParicion) : '—'}
          accent="orange"
        />
        <MiniKpi
          label="% Destete Parcial"
          value={kpis.stockBase ? formatPercent(kpis.pctDestete) : '—'}
          accent="orange"
        />
        <MiniKpi
          label="% Abortos"
          value={kpis.stockBase ? formatPercent(kpis.pctAbortos) : '—'}
          accent="terracota"
        />
        <MiniKpi
          label="% Muerte Señalado"
          value={kpis.nacimientos ? formatPercent(kpis.pctMuerteSenal) : '—'}
          accent="terracota"
        />
        <MiniKpi
          label="% Nacido Muerto"
          value={kpis.nacimientos ? formatPercent(kpis.pctNacidoMuerto) : '—'}
          accent="danger"
        />
        <MiniKpi
          label="Orejanos Excluidos"
          value={formatNumber(kpis.orejanos)}
          accent="navy"
        />
      </div>

      {/* Charts row A: 2 donuts (eventos + nacimientos segmentados) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Eventos" subtitle="Nacimientos vs muertes / abortos">
          <EventosDonut data={filtrados} />
        </Card>
        <Card title="Nacimientos segmentados" subtitle="Cabeza / Cuerpo / Cola — calculado por fecha">
          <NacimientosSegmentados data={filtrados} campos={campos} />
        </Card>
      </div>

      {/* Charts row B: causa de muerte + evolución mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Causa de muerte" subtitle="Detalle desde Pariciones">
          <CausaDeMuertePariciones data={filtrados} />
        </Card>
        <Card title="Evolución mensual" subtitle="Eventos cargados por mes, por tipo" className="lg:col-span-2">
          <ParicionesMensuales data={filtrados} />
        </Card>
      </div>

      {/* Charts row C: por campo y por grupo */}
      <div className="grid grid-cols-1 gap-4">
        <Card title="Actividad por campo" subtitle="Ranking de pariciones cargadas">
          <ParicionesPorCampo data={filtrados} campos={campos} />
        </Card>
        <Card title="Por grupo de vaca" subtitle="Cabeza / Cuerpo / Cola — stack por tipo de evento">
          <ParicionesPorGrupo data={filtrados} campos={campos} />
        </Card>
      </div>

      {/* Tabla */}
      <Card
        title="Pariciones cargadas"
        subtitle="Detalle completo — paginado"
        actions={
          <ExportCsvButton
            onClick={() => exportPariciones(filtrados, campos)}
            disabled={filtrados.length === 0}
            count={filtrados.length}
          />
        }
      >
        <ParicionesTable data={filtrados} campos={campos} />
      </Card>
    </div>
  );
}

// Export CSV de pariciones — columnas alineadas con lo que el cliente
// espera en su Excel: fecha humana primero, identificación del animal
// (campo, lote, caravana) en el medio, datos del evento al final.
function exportPariciones(rows: Paricion[], campos: Campo[]): void {
  const campoNombre = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;
  const cols: CsvColumn<Paricion>[] = [
    { header: 'Fecha',           value: r => r.fecha },
    { header: 'Campo',           value: r => campoNombre(r.campoId) },
    { header: 'Lote',            value: r => r.loteId ?? '' },
    { header: 'Grupo',           value: r => r.vacasGrupo },
    { header: 'Evento',          value: r => r.evento },
    { header: 'Sexo',            value: r => r.sexo ?? '' },
    { header: 'Asistencia',      value: r => r.asistencia ?? '' },
    { header: 'Caravana color',  value: r => r.caravanaColor ?? '' },
    { header: 'Caravana número', value: r => r.caravanaNumero ?? '' },
    { header: 'Causa tipo',      value: r => r.causaTipo ?? '' },
    { header: 'Causa detalle',   value: r => r.causaDetalle ?? '' },
    { header: 'Observaciones',   value: r => r.observaciones ?? '' },
    { header: 'Cargado por',     value: r => r.usuarioEmail },
    { header: 'Fecha de carga',  value: r => r.createdAt },
  ];
  const csv = rowsToCsv(rows, cols);
  downloadCsv(csv, csvFilename('pariciones'));
}

