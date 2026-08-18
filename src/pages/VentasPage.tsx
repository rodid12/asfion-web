// Ventas — operaciones con 1 a 4 grupos/categorías.
//
// Regla confirmada por el cliente (17/08/2026):
//   kg netos    = kg brutos × 0,92
//   kg promedio = kg netos / primer número de CANT CAB Y CAT
//
// La denominación se conserva literal. Para agrupar en el visualizador solo
// quitamos la cantidad inicial en una copia de lectura; nunca modificamos lo
// que escribió el administrador ni sus separadores.

import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CoinsIcon,
  ReceiptTextIcon,
  ScaleIcon,
  UsersIcon,
  WeightIcon,
} from 'lucide-react';

import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import { PageHeader } from '@/components/PageHeader';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import {
  SimpleFilterBar,
  SIMPLE_FILTROS_DEFAULT,
  añosEnData,
  enPeriodo,
  type SimpleFiltros,
} from '@/components/SimpleFilterBar';
import type { Campo, Venta, VentaGrupo } from '@/data/types';
import { formatNumber, formatPercent } from '@/lib/utils';
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';
import { fechaCorta } from '@/lib/fechas';

interface Props {
  ventas?: Venta[];
  campos: Campo[];
}

interface GrupoConVenta extends VentaGrupo {
  ventaId: string;
  fecha: string;
  correlativo: string;
}

type SexoDetectado = 'macho' | 'hembra' | undefined;

const SELECT_CLS =
  'bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy ' +
  'hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition cursor-pointer';

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Copia para métricas: saca solo el primer número; el original queda intacto. */
function etiquetaCategoria(texto: string): string {
  return texto.replace(/^\s*\d+(?:[.,]\d+)?\s*/, '').trim() || texto.trim();
}

/** Clasificación conservadora: si hay señales de ambos sexos, no adivina. */
function detectarSexo(texto: string): SexoDetectado {
  const t = normalizar(texto);
  const macho = /(^|[^a-z])(macho|machos|novillo|novillos|novillito|novillitos|toro|toros|tm\d*)($|[^a-z0-9])/.test(t);
  const hembra = /(^|[^a-z])(hembra|hembras|vaquillona|vaquillonas|vaca|vacas|ternera|terneras|th\d*)($|[^a-z0-9])/.test(t);
  if (macho === hembra) return undefined;
  return macho ? 'macho' : 'hembra';
}

export function VentasPage({ ventas = [], campos }: Props) {
  const [filtros, setFiltros] = useState<SimpleFiltros>({ ...SIMPLE_FILTROS_DEFAULT, rango: '12m' });
  const [consignado, setConsignado] = useState('todos');
  const [frigorifico, setFrigorifico] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  const añosDisponibles = useMemo(() => añosEnData(ventas.map(v => v.fecha)), [ventas]);
  const consignados = useMemo(
    () => [...new Set(ventas.map(v => v.consignado).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [ventas],
  );
  const frigorificos = useMemo(
    () => [...new Set(ventas.map(v => v.frigorifico).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [ventas],
  );

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return ventas.filter(v => {
      if (!enPeriodo(v.fecha, filtros)) return false;
      if (filtros.campoId !== 'todos' && v.campoId !== filtros.campoId) return false;
      if (consignado !== 'todos' && v.consignado !== consignado) return false;
      if (frigorifico !== 'todos' && v.frigorifico !== frigorifico) return false;
      if (q) {
        const hay = normalizar([
          v.correlativo, v.numeroDte, v.tropa, v.titular, v.consignado,
          v.frigorifico, v.observaciones, ...v.grupos.map(g => g.cantCabYCat),
        ].join(' '));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ventas, filtros, consignado, frigorifico, busqueda]);

  const grupos = useMemo<GrupoConVenta[]>(
    () => filtradas.flatMap(v => v.grupos.map(g => ({
      ...g, ventaId: v.id, fecha: v.fecha, correlativo: v.correlativo,
    }))),
    [filtradas],
  );

  const kpis = useMemo(() => {
    let cabezas = 0;
    let kgNetos = 0;
    let precioPorKg = 0;
    let machos = 0;
    let hembras = 0;
    let sinDiscriminar = 0;
    let importeTotal = 0;
    let ventasConImporte = 0;

    grupos.forEach(g => {
      cabezas += g.cabezas;
      kgNetos += g.kgNetos;
      precioPorKg += g.precio * g.kgNetos;
      const sexo = detectarSexo(g.cantCabYCat);
      if (sexo === 'macho') machos += g.cabezas;
      else if (sexo === 'hembra') hembras += g.cabezas;
      else sinDiscriminar += g.cabezas;
    });
    filtradas.forEach(v => {
      if (v.importeTotal != null && Number.isFinite(v.importeTotal)) {
        importeTotal += v.importeTotal;
        ventasConImporte++;
      }
    });
    const clasificados = machos + hembras;
    return {
      ventas: filtradas.length,
      cabezas,
      kgNetos,
      kgPromedio: cabezas > 0 ? kgNetos / cabezas : 0,
      precioPromedio: kgNetos > 0 ? precioPorKg / kgNetos : 0,
      machos,
      hembras,
      sinDiscriminar,
      pctMachos: clasificados > 0 ? machos / clasificados : 0,
      pctHembras: clasificados > 0 ? hembras / clasificados : 0,
      importeTotal,
      ventasConImporte,
      fechaUltima: filtradas.reduce((max, v) => v.fecha > max ? v.fecha : max, ''),
    };
  }, [filtradas, grupos]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, {
      categoria: string; grupos: number; cabezas: number; kgBrutos: number;
      kgNetos: number; precioKg: number;
    }>();
    grupos.forEach(g => {
      const categoria = etiquetaCategoria(g.cantCabYCat) || 'Sin categoría';
      const cur = map.get(categoria) ?? {
        categoria, grupos: 0, cabezas: 0, kgBrutos: 0, kgNetos: 0, precioKg: 0,
      };
      cur.grupos++;
      cur.cabezas += g.cabezas;
      cur.kgBrutos += g.kgBrutos;
      cur.kgNetos += g.kgNetos;
      cur.precioKg += g.precio * g.kgNetos;
      map.set(categoria, cur);
    });
    return [...map.values()]
      .map(r => ({
        ...r,
        kgPromedio: r.cabezas > 0 ? r.kgNetos / r.cabezas : 0,
        precioPromedio: r.kgNetos > 0 ? r.precioKg / r.kgNetos : 0,
      }))
      .sort((a, b) => b.cabezas - a.cabezas || a.categoria.localeCompare(b.categoria));
  }, [grupos]);

  const porMes = useMemo(() => {
    const map = new Map<string, { cabezas: number; kgNetos: number }>();
    grupos.forEach(g => {
      const key = g.fecha.slice(0, 7);
      const cur = map.get(key) ?? { cabezas: 0, kgNetos: 0 };
      cur.cabezas += g.cabezas;
      cur.kgNetos += g.kgNetos;
      map.set(key, cur);
    });
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([key, v]) => {
      const [year, month] = key.split('-');
      const index = Math.max(0, Math.min(11, Number(month) - 1));
      return { mes: `${MESES[index]} ${(year ?? '').slice(2)}`, ...v };
    });
  }, [grupos]);

  const limpiar = () => {
    setFiltros({ ...SIMPLE_FILTROS_DEFAULT, rango: '12m' });
    setConsignado('todos');
    setFrigorifico('todos');
    setBusqueda('');
  };
  const hayFiltrosExtra = consignado !== 'todos' || frigorifico !== 'todos' || busqueda.trim() !== '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventas"
        subtitle="Operaciones de venta con hasta cuatro categorías y desbaste fijo del 8%."
        count={{ value: kpis.ventas, label: kpis.ventas === 1 ? 'venta' : 'ventas' }}
        lastDate={kpis.fechaUltima || undefined}
        actions={
          <ExportCsvButton
            onClick={() => exportVentas(filtradas)}
            disabled={filtradas.length === 0}
            count={filtradas.length}
          />
        }
      />

      <SimpleFilterBar filtros={filtros} campos={campos} onChange={setFiltros} añosDisponibles={añosDisponibles} />

      <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 min-w-[180px] flex-1 sm:flex-none">
          <span className="text-[10px] uppercase font-bold tracking-wide text-asfion-muted">Consignado</span>
          <select value={consignado} onChange={e => setConsignado(e.target.value)} className={SELECT_CLS}>
            <option value="todos">Todos</option>
            {consignados.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 min-w-[180px] flex-1 sm:flex-none">
          <span className="text-[10px] uppercase font-bold tracking-wide text-asfion-muted">Frigorífico</span>
          <select value={frigorifico} onChange={e => setFrigorifico(e.target.value)} className={SELECT_CLS}>
            <option value="todos">Todos</option>
            {frigorificos.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 min-w-[220px] flex-[2]">
          <span className="text-[10px] uppercase font-bold tracking-wide text-asfion-muted">Buscar</span>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Correlativo, DTE, tropa, categoría…"
            className={SELECT_CLS + ' w-full'}
          />
        </label>
        {hayFiltrosExtra && (
          <button onClick={limpiar} className="px-3 py-2 text-sm font-semibold text-asfion-orange hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>

      {ventas.length === 0 ? (
        <Card title="Sin ventas cargadas" subtitle="El módulo está listo para recibir cargas desde la app o desde Excel">
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-asfion-orangeSoft flex items-center justify-center">
              <ReceiptTextIcon size={28} className="text-asfion-navyDeep" />
            </div>
            <p className="text-sm font-semibold text-asfion-navy">Todavía no hay operaciones de venta.</p>
            <p className="text-xs text-asfion-muted max-w-xl">
              Cada venta admite de una a cuatro categorías. El administrador carga kg brutos y la plataforma aplica
              automáticamente el 8% para obtener kg netos y el promedio por cabeza. Los identificadores, la tropa y
              el importe permanecen manuales.
            </p>
          </div>
        </Card>
      ) : filtradas.length === 0 ? (
        <Card title="Sin resultados" subtitle="No hay ventas que coincidan con los filtros aplicados">
          <div className="py-8 text-center">
            <button onClick={limpiar} className="text-sm font-bold text-asfion-orange hover:underline">Limpiar filtros</button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            <Kpi label="Ventas realizadas" value={formatNumber(kpis.ventas)} accent="orange" icon={<ReceiptTextIcon size={18} />} />
            <Kpi
              label="Cabezas vendidas"
              value={formatNumber(kpis.cabezas)}
              sublabel={kpis.sinDiscriminar > 0 ? `${formatNumber(kpis.sinDiscriminar)} sin sexo identificable` : ''}
              accent="orange"
              icon={<UsersIcon size={18} />}
            />
            <Kpi label="Kg netos vendidos" value={`${formatNumber(Math.round(kpis.kgNetos))} kg`} accent="navy" icon={<WeightIcon size={18} />} />
            <Kpi label="Kg promedio ponderado" value={kpis.kgPromedio.toFixed(2)} sublabel="Kg netos / cabezas" accent="navy" icon={<ScaleIcon size={18} />} />
            <Kpi
              label="Machos"
              value={`${formatNumber(kpis.machos)} (${formatPercent(kpis.pctMachos, 0)})`}
              sublabel="Sobre categorías con sexo identificable"
              accent="navy"
              icon={<UsersIcon size={18} />}
            />
            <Kpi
              label="Hembras"
              value={`${formatNumber(kpis.hembras)} (${formatPercent(kpis.pctHembras, 0)})`}
              sublabel="Sobre categorías con sexo identificable"
              accent="navy"
              icon={<UsersIcon size={18} />}
            />
            <Kpi
              label="Precio promedio"
              value={kpis.precioPromedio > 0 ? `$${formatNumber(Number(kpis.precioPromedio.toFixed(2)))}` : '—'}
              sublabel="Ponderado por kg netos"
              accent="terracota"
              icon={<CoinsIcon size={18} />}
            />
            <Kpi
              label="Importe informado"
              value={kpis.ventasConImporte > 0 ? `$${formatNumber(Math.round(kpis.importeTotal))}` : '—'}
              sublabel={kpis.ventasConImporte > 0 ? `${kpis.ventasConImporte} de ${kpis.ventas} ventas con importe` : 'Carga manual; no se calcula'}
              accent="terracota"
              icon={<CoinsIcon size={18} />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Cabezas por categoría" subtitle="Agrupadas por la denominación escrita después de la cantidad">
              <ResponsiveContainer width="100%" height={Math.max(280, Math.min(520, porCategoria.slice(0, 12).length * 38))}>
                <BarChart data={porCategoria.slice(0, 12)} layout="vertical" margin={{ top: 8, right: 48, left: 28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" horizontal={false} />
                  <XAxis type="number" stroke="#6B7280" fontSize={11} />
                  <YAxis type="category" dataKey="categoria" width={130} stroke="#6B7280" fontSize={10} tick={{ width: 125 }} />
                  <Tooltip formatter={(value: number) => [formatNumber(value), 'Cabezas']} />
                  <Bar dataKey="cabezas" name="Cabezas" fill="#FF8409" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="cabezas" position="right" fontSize={11} fill="#163349" formatter={(v: number) => formatNumber(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Ventas por mes" subtitle="Cabezas vendidas; el detalle de kg se muestra al pasar el cursor">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={porMes} margin={{ top: 24, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
                  <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip formatter={(value: number, name: string) => [formatNumber(Math.round(value)), name === 'kgNetos' ? 'Kg netos' : 'Cabezas']} />
                  <Bar dataKey="cabezas" name="Cabezas" fill="#163349" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="cabezas" position="top" fontSize={11} fill="#163349" formatter={(v: number) => formatNumber(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card title="Totales por categoría" subtitle="No se calculan totales por venta; se consolidan las categorías como pidió el cliente">
            <CategoriaTable rows={porCategoria} />
          </Card>

          <Card title="Detalle de ventas" subtitle="Identificación comercial y denominaciones originales, sin alterar separadores">
            <VentasTabla rows={filtradas} campos={campos} />
          </Card>
        </>
      )}
    </div>
  );
}

function CategoriaTable({ rows }: { rows: Array<{
  categoria: string; grupos: number; cabezas: number; kgBrutos: number; kgNetos: number;
  kgPromedio: number; precioPromedio: number;
}> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
            <th className="py-2 px-2 font-semibold">Categoría</th>
            <th className="py-2 px-2 font-semibold text-right">Grupos</th>
            <th className="py-2 px-2 font-semibold text-right">Cabezas</th>
            <th className="py-2 px-2 font-semibold text-right">Kg brutos</th>
            <th className="py-2 px-2 font-semibold text-right">Kg netos</th>
            <th className="py-2 px-2 font-semibold text-right">Kg promedio</th>
            <th className="py-2 px-2 font-semibold text-right">Precio prom.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.categoria} className="border-b border-asfion-borderSoft/50 hover:bg-asfion-bg/60">
              <td className="py-2 px-2 font-semibold text-asfion-navyDeep">{r.categoria}</td>
              <td className="py-2 px-2 text-right tabular-nums">{formatNumber(r.grupos)}</td>
              <td className="py-2 px-2 text-right tabular-nums font-bold">{formatNumber(r.cabezas)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{formatNumber(Number(r.kgBrutos.toFixed(2)))}</td>
              <td className="py-2 px-2 text-right tabular-nums">{formatNumber(Number(r.kgNetos.toFixed(2)))}</td>
              <td className="py-2 px-2 text-right tabular-nums">{r.kgPromedio.toFixed(2)}</td>
              <td className="py-2 px-2 text-right tabular-nums">${formatNumber(Number(r.precioPromedio.toFixed(2)))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VentasTabla({ rows, campos }: { rows: Venta[]; campos: Campo[] }) {
  const campoMap = new Map(campos.map(c => [c.id, c.nombre]));
  const ordenadas = [...rows].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[980px]">
        <thead>
          <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
            <th className="py-2 px-2 font-semibold">Fecha</th>
            <th className="py-2 px-2 font-semibold">Correlativo</th>
            <th className="py-2 px-2 font-semibold">Campo</th>
            <th className="py-2 px-2 font-semibold">CANT CAB Y CAT</th>
            <th className="py-2 px-2 font-semibold">Consignado</th>
            <th className="py-2 px-2 font-semibold">Frigorífico</th>
            <th className="py-2 px-2 font-semibold">DTE</th>
            <th className="py-2 px-2 font-semibold">Tropa</th>
            <th className="py-2 px-2 font-semibold text-right">Importe manual</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map(v => (
            <tr key={v.id} className="border-b border-asfion-borderSoft/50 align-top hover:bg-asfion-bg/60">
              <td className="py-2 px-2 tabular-nums whitespace-nowrap">{fechaCorta(v.fecha)}</td>
              <td className="py-2 px-2 font-bold text-asfion-orange whitespace-nowrap">{v.correlativo}</td>
              <td className="py-2 px-2 whitespace-nowrap">{campoMap.get(v.campoId) ?? v.campoId}</td>
              <td className="py-2 px-2 min-w-[260px]">
                <ol className="space-y-1">
                  {v.grupos.map(g => <li key={g.orden}><span className="text-asfion-muted mr-1">{g.orden}.</span>{g.cantCabYCat}</li>)}
                </ol>
              </td>
              <td className="py-2 px-2">{v.consignado}</td>
              <td className="py-2 px-2">{v.frigorifico}</td>
              <td className="py-2 px-2 whitespace-nowrap">{v.numeroDte}</td>
              <td className="py-2 px-2 whitespace-nowrap">{v.tropa}</td>
              <td className="py-2 px-2 text-right tabular-nums font-semibold whitespace-nowrap">
                {v.importeTotal != null ? `$${formatNumber(Number(v.importeTotal.toFixed(2)))}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function exportVentas(rows: Venta[]): void {
  const grupo = (v: Venta, index: number): VentaGrupo | undefined => v.grupos[index];
  const cols: CsvColumn<Venta>[] = [
    { header: 'ID_Venta',       value: r => r.id },
    { header: 'FECHA',          value: r => r.fecha },
    { header: 'CANT CAB Y CAT', value: r => grupo(r, 0)?.cantCabYCat ?? '' },
    { header: 'KG Brutos',      value: r => grupo(r, 0)?.kgBrutos ?? '' },
    { header: 'KG Netos',       value: r => grupo(r, 0)?.kgNetos ?? '' },
    { header: 'Kg Promedio',    value: r => grupo(r, 0)?.kgPromedio ?? '' },
    { header: 'Precio',         value: r => grupo(r, 0)?.precio ?? '' },
    { header: 'CANT CAB Y CAT2',value: r => grupo(r, 1)?.cantCabYCat ?? '' },
    { header: 'KG Brutos2',     value: r => grupo(r, 1)?.kgBrutos ?? '' },
    { header: 'KG Netos2',      value: r => grupo(r, 1)?.kgNetos ?? '' },
    { header: 'Kg Promedio2',   value: r => grupo(r, 1)?.kgPromedio ?? '' },
    { header: 'Precio2',        value: r => grupo(r, 1)?.precio ?? '' },
    { header: 'CANT CAB Y CAT3',value: r => grupo(r, 2)?.cantCabYCat ?? '' },
    { header: 'KG Brutos3',     value: r => grupo(r, 2)?.kgBrutos ?? '' },
    { header: 'KG Netos3',      value: r => grupo(r, 2)?.kgNetos ?? '' },
    { header: 'Kg Promedio3',   value: r => grupo(r, 2)?.kgPromedio ?? '' },
    { header: 'Precio3',        value: r => grupo(r, 2)?.precio ?? '' },
    { header: 'CANT CAB Y CAT4',value: r => grupo(r, 3)?.cantCabYCat ?? '' },
    { header: 'KG Brutos4',     value: r => grupo(r, 3)?.kgBrutos ?? '' },
    { header: 'KG Netos4',      value: r => grupo(r, 3)?.kgNetos ?? '' },
    { header: 'Kg Promedio4',   value: r => grupo(r, 3)?.kgPromedio ?? '' },
    { header: 'Precio4',        value: r => grupo(r, 3)?.precio ?? '' },
    { header: 'Consignado',     value: r => r.consignado },
    { header: 'Titular',        value: r => r.titular },
    { header: 'Pago',           value: r => r.pago },
    { header: 'Frigorifico',    value: r => r.frigorifico },
    { header: 'Numero DTE',     value: r => r.numeroDte },
    { header: 'Correlativo',    value: r => r.correlativo },
    { header: 'Tropa',          value: r => r.tropa },
    { header: 'Observaciones',  value: r => r.observaciones },
    { header: 'Importe Total',  value: r => r.importeTotal ?? '' },
  ];
  void downloadCsv(rowsToCsv(rows, cols), csvFilename('ventas'));
}
