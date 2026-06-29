// Página del módulo Pariciones.
//
// REFACTORIZADA en A4 del audit arquitectónico — antes este archivo tenía
// 619 líneas con 2 ramas de cálculo (kpis DAX legacy + resumenTotales del
// Excel) conviviendo en el mismo render. Ahora:
//
//   - computeResumenTotales() — función pura → calcula totales del Excel
//   - computeKpisLegacy()     — función pura → calcula fórmulas DAX
//   - <KpisDesdeResumen>      — render del grid Excel (3 filas)
//   - <KpisLegacy>            — render del grid DAX (3 filas)
//
// Esta page solo orquesta:
//   1. Filtros (rango/campo/evento)
//   2. Decide si hay resumen del cierre → KpisDesdeResumen, sino KpisLegacy
//   3. Charts (donut, mensuales, por campo, por grupo, causa muerte)
//   4. Tabla con export CSV
//   5. ResumenServicioTable al final (cuando hay)
//
// Pieza testeable (A5): las funciones puras de cálculo se pueden cubrir
// con tests unitarios sin necesidad de DOM ni props complejas.

import React, { useMemo, useState } from 'react';
import { Card } from '@/components/Card';
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
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';
import type { Campo, Paricion, ResumenServicio } from '@/data/types';
import { ResumenServicioTable } from '@/components/ResumenServicioTable';
import { campoNombreFn } from '@/lib/campoMap';
import { KpisDesdeResumen } from '@/components/pariciones/KpisDesdeResumen';
import { KpisLegacy } from '@/components/pariciones/KpisLegacy';
import { computeResumenTotales } from '@/components/pariciones/computeResumenTotales';
import { computeKpisLegacy } from '@/components/pariciones/computeKpisLegacy';

interface Props {
  pariciones: Paricion[];
  campos: Campo[];
  /** Resumen mermas servicio por tropa (Excel Hoja 3). Opcional — si está
   *  cargado el KPI grid de arriba lo prefiere; sino cae al DAX legacy. */
  resumenServicio?: ResumenServicio[];
}

export function ParicionesPage({ pariciones, campos, resumenServicio = [] }: Props) {
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

  // Campos visibles según el filtro de campo (1 o todos). El Stock Base se
  // suma sobre los visibles para que cuando el cliente filtre "Picaflor",
  // el denominador sea solo el de Picaflor (lo usa KpisLegacy).
  const camposVisibles = useMemo(() => {
    if (filtros.campoId === 'todos') return campos;
    return campos.filter(c => c.id === filtros.campoId);
  }, [filtros.campoId, campos]);

  // Resumen del servicio — fuente preferida. Si está, mostramos
  // KpisDesdeResumen; sino, KpisLegacy desde eventos individuales.
  const resumenTotales = useMemo(
    () => computeResumenTotales(resumenServicio),
    [resumenServicio],
  );

  // KpisLegacy solo se calcula cuando NO hay resumen — early bail-out
  // ahorra ~20-40ms de fórmulas DAX sobre 2.5k pariciones (audit N12).
  const kpisLegacy = useMemo(
    () => resumenTotales ? null : computeKpisLegacy(filtrados, camposVisibles),
    [resumenTotales, filtrados, camposVisibles],
  );

  // Texto del título: si hay un campo seleccionado, lo nombramos.
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

      {/* KPIs principales — Excel-faithful cuando hay resumen, DAX legacy
          como fallback. La preferencia por el resumen está documentada en
          el comentario inline de computeResumenTotales. */}
      {resumenTotales
        ? <KpisDesdeResumen totales={resumenTotales} />
        : kpisLegacy && <KpisLegacy kpis={kpisLegacy} />}

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

      {/* Resumen Mermas Servicio — agregado anual por tropa con la columna
          "Terneros Vivos" destacada en verde (pedido explícito del cliente). */}
      {resumenServicio.length > 0 && (
        <ResumenServicioTable rows={resumenServicio} />
      )}
    </div>
  );
}

// Export CSV de pariciones — columnas alineadas con lo que el cliente
// espera en su Excel: fecha humana primero, identificación del animal
// (campo, lote, caravana) en el medio, datos del evento al final.
function exportPariciones(rows: Paricion[], campos: Campo[]): void {
  // Map precomputado — antes O(N×M) en cada click (audit item 11).
  const campoNombre = campoNombreFn(campos);
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
