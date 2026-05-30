// Página del módulo Pariciones — contenido que antes vivía en Dashboard.tsx
// (KPIs, filtros, charts, tabla). Ahora es solo una "vista" que Dashboard
// renderea cuando la tab activa es 'pariciones'.

import React, { useMemo, useState } from 'react';
import {
  BabyIcon,
  HeartCrackIcon,
  SkullIcon,
  TrendingUpIcon,
} from 'lucide-react';
import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import { FilterBar } from '@/components/FilterBar';
import { ParicionesTable } from '@/components/ParicionesTable';
import { ParicionesMensuales } from '@/charts/ParicionesMensuales';
import { DistribucionEventos } from '@/charts/DistribucionEventos';
import { ParicionesPorCampo } from '@/charts/ParicionesPorCampo';
import { ParicionesPorGrupo } from '@/charts/ParicionesPorGrupo';
import { SexoYAsistencia } from '@/charts/SexoYAsistencia';
import { ExportCsvButton } from '@/components/ExportCsvButton';
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

  const kpis = useMemo(() => {
    const total = filtrados.length;
    const nacimientos = filtrados.filter(p => p.evento === 'Nacimiento').length;
    const muertes = filtrados.filter(p => p.evento === 'Muerte').length;
    const abortos = filtrados.filter(p => p.evento === 'Aborto').length;
    const tasaMuertes = total ? (muertes + abortos) / total : 0;
    const asistidos = filtrados.filter(p => p.evento === 'Nacimiento' && p.asistencia === 'Si').length;
    const pctAsistencia = nacimientos ? asistidos / nacimientos : 0;

    const byCampo = new Map<string, number>();
    for (const p of filtrados) byCampo.set(p.campoId, (byCampo.get(p.campoId) ?? 0) + 1);
    const [topCampoId] = [...byCampo.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    const topCampo = campos.find(c => c.id === topCampoId)?.nombre ?? '—';

    return { total, nacimientos, muertes, abortos, tasaMuertes, pctAsistencia, topCampo };
  }, [filtrados, campos]);

  if (pariciones.length === 0) {
    return <EmptyModule label="pariciones" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-asfion-deep">Pariciones</h2>
          <p className="text-sm text-asfion-muted mt-1">
            Resumen de actividad de parición a través de todos los campos.
          </p>
        </div>
        <div className="text-sm text-asfion-muted">
          <span className="font-semibold text-asfion-dark">{formatNumber(filtrados.length)}</span> eventos
          <span className="mx-2">·</span>
          últimos datos: <span className="tabular-nums text-asfion-dark">{filtrados[0]?.fecha ?? '—'}</span>
        </div>
      </div>

      <FilterBar filtros={filtros} campos={campos} onChange={setFiltros} />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Total en el período"
          value={formatNumber(kpis.total)}
          accent="dark"
          icon={<TrendingUpIcon size={18} />}
        />
        <Kpi
          label="Nacimientos"
          value={formatNumber(kpis.nacimientos)}
          sublabel={`${formatPercent(kpis.total ? kpis.nacimientos / kpis.total : 0)} del total`}
          accent="lime"
          icon={<BabyIcon size={18} />}
        />
        <Kpi
          label="Muertes + Abortos"
          value={formatNumber(kpis.muertes + kpis.abortos)}
          sublabel={`${formatPercent(kpis.tasaMuertes)} de mortalidad`}
          accent="terracota"
          icon={<SkullIcon size={18} />}
        />
        <Kpi
          label="% Asistencia"
          value={formatPercent(kpis.pctAsistencia)}
          sublabel={`Campo top: ${kpis.topCampo}`}
          accent="dark"
          icon={<HeartCrackIcon size={18} />}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Evolución mensual"
          subtitle="Eventos cargados por mes, por tipo"
          className="lg:col-span-2"
        >
          <ParicionesMensuales data={filtrados} />
        </Card>

        <Card title="Distribución" subtitle="Por tipo de evento">
          <DistribucionEventos data={filtrados} />
        </Card>
      </div>

      {/* Charts row 2: grupo + nacimientos
          La distribución por grupo de vaca (cabeza/cuerpo/cola) es
          información clave del cliente final — permite ver qué cohorte
          tiene más muertes/abortos. La pusimos arriba de "actividad por
          campo" porque el agrupamiento por grupo es más conceptual
          (zoom out: cómo se distribuye el rodeo) y el de campo es más
          operativo (zoom in: dónde focusear). */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Por grupo de vaca"
          subtitle="Cabeza / Cuerpo / Cola — stack por tipo de evento"
          className="lg:col-span-2"
        >
          <ParicionesPorGrupo data={filtrados} />
        </Card>

        <Card title="Nacimientos" subtitle="Detalle de cría">
          <SexoYAsistencia data={filtrados} />
        </Card>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 gap-4">
        <Card
          title="Actividad por campo"
          subtitle="Ranking de pariciones cargadas — stack por tipo de evento"
        >
          <ParicionesPorCampo data={filtrados} campos={campos} />
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

// Empty state compartido (extraerlo a un componente más adelante si crece).
function EmptyModule({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-asfion-borderSoft bg-white px-6 py-10 text-center">
      <p className="text-asfion-dark font-semibold">Todavía no hay {label} cargadas.</p>
      <p className="text-sm text-asfion-muted mt-1">
        En cuanto los operarios carguen eventos desde la app, los vas a ver acá.
      </p>
    </div>
  );
}
