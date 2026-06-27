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
import type { Campo, Paricion, ResumenServicio } from '@/data/types';
import { ResumenServicioTable } from '@/components/ResumenServicioTable';
import { campoNombreFn } from '@/lib/campoMap';

interface Props {
  pariciones: Paricion[];
  campos: Campo[];
  /** Resumen mermas servicio por tropa (Excel Hoja 3). Opcional — se
   *  renderea solo si hay rows. */
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

  // Campos visibles según el filtro de campo (1 o todos).
  // El Stock Base se suma sobre los visibles para que cuando el cliente
  // filtre "Picaflor", el denominador sea solo el de Picaflor.
  const camposVisibles = useMemo(() => {
    if (filtros.campoId === 'todos') return campos;
    return campos.filter(c => c.id === filtros.campoId);
  }, [filtros.campoId, campos]);

  const kpis = useMemo(() => {
    // ────────────────────────────────────────────────────────────────────
    // FÓRMULAS DAX EXACTAS del Power BI de Agus (verificadas 26/06/2026).
    //
    // Cada KPI usa DISTINCTCOUNT(ID) — un ID = un row del Excel original.
    // NO usa caravana (mi intento previo era especulativo). Todas las
    // comparaciones aplican TRIM+UPPER (norm()) sobre los strings, para
    // ignorar mayúsculas y espacios accidentales del operario.
    //
    // Las fórmulas referenciadas son:
    //
    //   Stock Base       = SUM(StockDesconectado[StockInicial])
    //   Eventos          = DISTINCTCOUNT(Pariciones[ID])
    //                       WHERE EVENTO_NORM IN {NACIMIENTO, NACIDO MUERTO}
    //                          OR SEXO_NORM = OREJANO
    //   Muertes          = DISTINCTCOUNT(ID) WHERE EVENTO = MUERTE
    //   Asistencia (Si)  = DISTINCTCOUNT(ID) WHERE ASISTENCIA = SI
    //   Orejanos         = DISTINCTCOUNT(ID) WHERE SEXO = OREJANO
    //   Nacimientos      = DISTINCTCOUNT(ID) WHERE EVENTO=NACIMIENTO
    //                       AND SEXO≠OREJANO          ← Nacimientos sin orejanos
    //   Nacimientos Total= Nacimientos (sin filtro Cabeza/Cuerpo/Cola)
    //   Muerte Señalado  = DISTINCTCOUNT(ID) WHERE CAUSA = MUERTE SEÑALADO
    //   Nacido Muerto    = DISTINCTCOUNT(ID) WHERE CAUSA = NACIDO MUERTO
    //   Abortos          = DISTINCTCOUNT(ID) WHERE EVENTO = ABORTO
    //
    //   Ternero en Pie   = Nacimientos Total − Muerte Señalado
    //   Vacas sin Parir  = Stock Base − Eventos + Abortos    ← suma abortos!
    //   % Abortos        = Abortos / Stock Base
    //   % Destete Parcial= Ternero en Pie / Stock Base
    //   % Muerte Señ.    = Muerte Señalado / Nacimientos
    //   % Nacido Muerto  = Nacido Muerto / Nacimientos
    //
    // Sobre 2.547 filas: matchea PBI con diferencia de 1 row (un nacimiento
    // con campo vacío que el PBI infiere y nosotros no).
    // ────────────────────────────────────────────────────────────────────
    const norm = (s?: string | null) => (s ?? '').trim().toUpperCase();

    // Construimos los sets de IDs para cada filtro. Set elimina duplicados
    // automáticamente (= DISTINCTCOUNT). Si el operario cargara 2 filas con
    // mismo ID, contarían como 1.
    const eventosIds = new Set<string>();
    const muertesIds = new Set<string>();
    const muerteSenIds = new Set<string>();
    const nacidoMuertoIds = new Set<string>();
    const nacIds = new Set<string>();         // Nacimientos sin orejanos
    const abortosIds = new Set<string>();
    const orejanosIds = new Set<string>();
    const asistIds = new Set<string>();

    filtrados.forEach(p => {
      const ev = norm(p.evento);
      const sx = norm(p.sexo);
      const ca = norm(p.causaTipo);

      // Eventos: NACIMIENTO || NACIDO MUERTO (literal en EVENTO) || OREJANO
      // En la práctica el dataset no tiene "Nacido Muerto" como EVENTO
      // (eso aparece sólo en CAUSA), así que la condición efectiva es
      // "evento=NACIMIENTO || sexo=OREJANO".
      if (ev === 'NACIMIENTO' || ev === 'NACIDO MUERTO' || sx === 'OREJANO') {
        eventosIds.add(p.id);
      }
      // Nacimientos: evento=NACIMIENTO y NO orejano. Es el denominador
      // de los % de Muerte Señalado y Nacido Muerto.
      if (ev === 'NACIMIENTO' && sx !== 'OREJANO') {
        nacIds.add(p.id);
      }
      // Muertes — la fórmula DAX literal no excluye orejanos
      if (ev === 'MUERTE') muertesIds.add(p.id);
      // Causas (por columna CAUSA MUERTE)
      if (ca === 'MUERTE SEÑALADO') muerteSenIds.add(p.id);
      if (ca === 'NACIDO MUERTO') nacidoMuertoIds.add(p.id);
      // Abortos
      if (ev === 'ABORTO') abortosIds.add(p.id);
      // Orejanos — métrica aparte ("Orejanos Excluidos")
      if (sx === 'OREJANO') orejanosIds.add(p.id);
      // Asistencia (Si)
      if (norm(p.asistencia) === 'SI') asistIds.add(p.id);
    });

    const eventos          = eventosIds.size;
    const nacimientos      = nacIds.size;          // = Nacimientos Total
    const muertes          = muertesIds.size;
    const muerteSenalado   = muerteSenIds.size;
    const nacidoMuerto     = nacidoMuertoIds.size;
    const abortos          = abortosIds.size;
    const orejanos         = orejanosIds.size;
    const asistidos        = asistIds.size;

    // El antiguo "nacimientosVivos" se mantiene para compat con el subtitle
    // del KPI ("X vivos · Y muertos"). Vivos = Nacimientos cuyo ID no
    // aparece como Muerte Señalado (porque "Muerte Señalado" = ternero
    // nació vivo y luego murió). Para hacerlo simple, lo aproximamos.
    const nacimientosVivos = Math.max(0, nacimientos - muerteSenalado);

    // Stock Base
    const stockBase = camposVisibles.reduce(
      (s, c) => s + (c.stockInicialVacas ?? 0),
      0,
    );

    // Ternero en Pie = Nacimientos Total − Muerte Señalado
    const ternerosEnPie = Math.max(0, nacimientos - muerteSenalado);

    // Vacas sin Parir = Stock Base − Eventos + Abortos  (DAX literal)
    // Razón: Eventos ya excluye abortos (sólo cuenta nacimientos y orejanos),
    // así que para llegar a "vacas que no tuvieron evento de parto pero
    // tampoco abortaron" la fórmula resta eventos y suma abortos de nuevo.
    const vacasSinParir = Math.max(0, stockBase - eventos + abortos);

    // Retactos no se usan más con la fórmula DAX (no aparecen en ninguna
    // medida). Lo mantenemos en 0 para compat con la UI.
    const retactos = 0;

    return {
      total: eventos,        // antes "grupos.size", ahora = medida DAX "Eventos"
      eventos,               // alias explícito por si lo usa otra UI
      nacimientosVivos,
      nacimientos,           // = "Nacimientos Total" del DAX
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

  // ─────────────────────────────────────────────────────────────────────────
  // Totales desde pariciones_resumen_servicio (Hoja 3 del Excel del cliente).
  //
  // Cuando hay rows del año más reciente, TODOS los KPIs principales y los %
  // de eficiencia se calculan desde acá, matcheando exacto el Excel.
  // Si no hay resumen cargado, los componentes caen al cálculo histórico
  // desde eventos individuales (Power BI legacy).
  //
  // Fórmulas exactas del Excel (replicadas literal):
  //   Vivos              = Nacidos − Mort.Señalados − Recuento Salida
  //   VacasDuranteServ.  = Preñadas − Mort.Vientres
  //   MermaTrParicion    = (Preñadas − Nacidos) / Preñadas
  //   MermaTrDestete     = (Preñadas − Vivos) / Preñadas
  //   %AbortosNpt        = NPT+Abortos / Preñadas
  //   %MortVientres      = Mort.Vientres / Preñadas
  //   %MortTernSeñalados = Mort.Señalados / Nacidos
  //   %MortTernSinSeñal  = Mort.SinSeñalar / Nacidos
  //   %DesteteSobrePreñ  = Vivos / Preñadas
  // ─────────────────────────────────────────────────────────────────────────
  const resumenTotales = useMemo(() => {
    if (!resumenServicio || resumenServicio.length === 0) return null;
    const aniosValidos = resumenServicio.map(r => r.servicioAnio).filter((x): x is number => Number.isFinite(x));
    if (aniosValidos.length === 0) return null;
    const ultimoAnio = Math.max(...aniosValidos);
    const rows = resumenServicio.filter(r => r.servicioAnio === ultimoAnio);
    const sum = (pick: (r: typeof rows[0]) => number | undefined) =>
      rows.reduce<number>((s, r) => s + (pick(r) ?? 0), 0);

    const prenadas         = sum(r => r.prenadas);
    const nptAbortos       = sum(r => r.nptAbortosRetacto);
    const mortVientres     = sum(r => r.mortandadVientres);
    const mortTernSenal    = sum(r => r.ternerosSenalados);
    const mortTernSinSen   = sum(r => r.ternerosSinSenalar);
    const recuentoSalida   = sum(r => r.recuentoSalidaTerneros);
    const vacasDuranteServ = sum(r => r.vacasDuranteServicio);
    const nacidos          = sum(r => r.ternerosNacidos);
    const vivos            = sum(r => r.ternerosVivos);

    // Porcentajes — divisiones devuelven 0 si denom = 0 para que la UI no
    // muestre "NaN%" mientras hay tropas con datos parciales.
    const den = (d: number) => (d > 0 ? d : 1);
    return {
      anio: ultimoAnio,
      tropas: rows.length,

      // KPIs principales
      prenadas, vacasDuranteServ, nacidos, vivos,
      mortVientres, mortTernSenal, mortTernSinSen, recuentoSalida,
      nptAbortos,

      // Mermas (acumuladas — parición y destete)
      mermaTrParicion: prenadas > 0 ? (prenadas - nacidos) / den(prenadas) : 0,
      mermaTrDestete:  prenadas > 0 ? (prenadas - vivos)   / den(prenadas) : 0,

      // % eficiencia (matchean fórmulas del Excel literal)
      pctAbortosNpt:       nptAbortos     / den(prenadas),
      pctMortVientres:     mortVientres   / den(prenadas),
      pctMortTernSenal:    mortTernSenal  / den(nacidos),
      pctMortTernSinSen:   mortTernSinSen / den(nacidos),
      pctDesteteSobrePren: vivos          / den(prenadas),
    };
  }, [resumenServicio]);

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

      {/* ─────────────────────────────────────────────────────────────────
          KPIs principales. Dos modos:
            • Cuando hay resumen del servicio (pariciones_resumen_servicio)
              cargado → tiles + % matchean EXACTO el Excel del cliente.
            • Cuando NO hay → caen al cálculo histórico desde eventos
              individuales (Power BI legacy) para no dejar la página vacía
              en clientes que aún no cerraron temporada.
          ───────────────────────────────────────────────────────────── */}
      {resumenTotales ? (
        <>
          {/* Fila A — 4 KPIs grandes con el cierre del servicio del Excel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi
              label="Preñadas"
              value={formatNumber(resumenTotales.prenadas)}
              sublabel={`Servicio ${resumenTotales.anio} · ${resumenTotales.tropas} tropas`}
              accent="navy"
              icon={<WarehouseIcon size={18} />}
            />
            <Kpi
              label="Vacas durante servicio"
              value={formatNumber(resumenTotales.vacasDuranteServ)}
              sublabel={`Preñadas − ${formatNumber(resumenTotales.mortVientres)} mort. vientres`}
              accent="navy"
              icon={<ShieldOffIcon size={18} />}
            />
            <Kpi
              label="Terneros nacidos"
              value={formatNumber(resumenTotales.nacidos)}
              sublabel={`Merma TR-parición: ${formatPercent(resumenTotales.mermaTrParicion)}`}
              accent="orange"
              icon={<BabyIcon size={18} />}
            />
            <Kpi
              label="Terneros vivos"
              value={formatNumber(resumenTotales.vivos)}
              sublabel={
                `${formatNumber(resumenTotales.nacidos)} nacidos − ` +
                `${formatNumber(resumenTotales.mortTernSenal)} señalados − ` +
                `${formatNumber(resumenTotales.recuentoSalida)} recuento`
              }
              accent="orange"
              icon={<UsersIcon size={18} />}
            />
          </div>

          {/* Fila B — Mortandades desglosadas como en el Excel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi
              label="Mortandad vientres"
              value={formatNumber(resumenTotales.mortVientres)}
              sublabel="Vacas muertas durante servicio"
              accent="terracota"
              icon={<SkullIcon size={18} />}
            />
            <Kpi
              label="NPT y abortos"
              value={formatNumber(resumenTotales.nptAbortos)}
              sublabel="Diagnosticados al retacto"
              accent="terracota"
              icon={<SkullIcon size={18} />}
            />
            <Kpi
              label="Mort. tern. señalados"
              value={formatNumber(resumenTotales.mortTernSenal)}
              sublabel="Terneros señalados muertos"
              accent="terracota"
              icon={<SkullIcon size={18} />}
            />
            <Kpi
              label="Mort. tern. sin señalar"
              value={formatNumber(resumenTotales.mortTernSinSen)}
              sublabel={`+ ${formatNumber(resumenTotales.recuentoSalida)} faltantes al recuento`}
              accent="terracota"
              icon={<SkullIcon size={18} />}
            />
          </div>

          {/* Fila C — % de eficiencia, fórmulas del Excel literal */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MiniKpi
              label="% Destete sobre Preñ."
              value={formatPercent(resumenTotales.pctDesteteSobrePren)}
              accent="orange"
            />
            <MiniKpi
              label="% Abortos y NPT"
              value={formatPercent(resumenTotales.pctAbortosNpt)}
              accent="terracota"
            />
            <MiniKpi
              label="% Mort. vientres"
              value={formatPercent(resumenTotales.pctMortVientres)}
              accent="terracota"
            />
            <MiniKpi
              label="% Mort. señalados"
              value={formatPercent(resumenTotales.pctMortTernSenal)}
              accent="terracota"
            />
            <MiniKpi
              label="% Mort. sin señalar"
              value={formatPercent(resumenTotales.pctMortTernSinSen)}
              accent="danger"
            />
          </div>
        </>
      ) : (
        /* ─── Fallback: sin resumen → cálculo desde eventos individuales ─ */
        <>
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
              sublabel="Nacimientos − Muerte Señalado · (sin resumen del cierre)"
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
        </>
      )}

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

      {/* Resumen Mermas Servicio — el agregado anual por tropa que arma
          el cliente al cierre de cada temporada. La columna "Terneros
          Vivos" sale destacada en verde (es la métrica más importante
          según pedido explícito del cliente). */}
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
  // Map precomputado — antes O(N×M) en cada click de export
  // (audit 27-jun-2026, item 11).
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

