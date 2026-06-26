// Página del módulo Ventas.
//
// Concepto: salidas de hacienda — animales que se venden a frigorífico,
// remates o productores. Es la otra cara de Compras (que registra las
// entradas al sistema). Cada venta tiene cliente / frigorífico, cantidad
// de cabezas, kg vendidos, precio por kilo y monto total.
//
// Estado actual: el form de carga todavía no existe en la app móvil.
// Cuando se enchufe la fuente (form propio o sync de planilla), llega
// data poblada via prop `ventas` y todo se calcula automático. Por ahora
// la página renderiza empty state.
//
// KPIs target (cuando haya data):
//   - Cabezas vendidas
//   - Monto recaudado total
//   - Peso total vendido
//   - Precio promedio $/kg (ponderado por kg)
//   - Venta más reciente

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
  CalendarDaysIcon,
  CoinsIcon,
  PackageIcon,
  TrendingUpIcon,
  UsersIcon,
  WeightIcon,
} from 'lucide-react';
import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import { PageHeader } from '@/components/PageHeader';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import {
  enPeriodo,
  añosEnData,
  type SimpleFiltros,
} from '@/components/SimpleFilterBar';
import { cn, formatNumber } from '@/lib/utils';
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';

/**
 * Shape de un row de venta. Cuando se enchufe la fuente real, exportar
 * desde data/types.ts y reemplazar en la prop.
 */
export interface Venta {
  id: string;
  fecha: string;
  cliente: string;           // ej: "Frigorífico Rioplatense", "Remate Las Lajas"
  campo?: string;
  categoria: string;         // ej: "Novillo", "Vaquillona", "Vaca descarte"
  cabezas: number;
  pesoTotal: number;         // kg totales vendidos
  precioPorKg: number;       // $/kg
  monto: number;             // $ totales
  observaciones?: string;
}

interface Props {
  ventas?: Venta[];
}

export function VentasPage({ ventas = [] }: Props) {
  const [cliente, setCliente] = useState<string>('todos');
  // Filtros de período — mismo patrón que el resto del dashboard.
  const [filtrosPeriodo, setFiltrosPeriodo] = useState<SimpleFiltros>({
    rango: '12m',
    campoId: 'todos',  // no se usa acá pero la interfaz lo requiere
  });

  const clientesUnicos = useMemo(() => {
    const s = new Set(ventas.map(v => v.cliente));
    return ['todos', ...Array.from(s).sort()];
  }, [ventas]);

  const añosDisponibles = useMemo(
    () => añosEnData(ventas.map(v => v.fecha)),
    [ventas],
  );

  const filtradas = useMemo(() => {
    return ventas.filter(v => {
      if (!enPeriodo(v.fecha, filtrosPeriodo)) return false;
      if (cliente !== 'todos' && v.cliente !== cliente) return false;
      return true;
    });
  }, [ventas, cliente, filtrosPeriodo]);

  const kpis = useMemo(() => {
    if (filtradas.length === 0) {
      return {
        cabezas: 0, pesoTotal: 0, monto: 0,
        precioPromedio: 0, fechaUltima: '—',
      };
    }
    let cabezas = 0, pesoTotal = 0, monto = 0;
    let maxFecha = '';
    filtradas.forEach(v => {
      cabezas += v.cabezas;
      pesoTotal += v.pesoTotal;
      monto += v.monto;
      if (v.fecha > maxFecha) maxFecha = v.fecha;
    });
    // Precio promedio = ponderado por kg vendidos (matchea con cómo
    // se calcula el costo de hacienda en libros agropecuarios).
    const precioPromedio = pesoTotal > 0 ? monto / pesoTotal : 0;
    return {
      cabezas,
      pesoTotal,
      monto,
      precioPromedio,
      fechaUltima: maxFecha || '—',
    };
  }, [filtradas]);

  // Ventas por mes (cuando haya data).
  const porMes = useMemo(() => {
    const map = new Map<string, { cabezas: number; monto: number }>();
    filtradas.forEach(v => {
      const key = v.fecha.slice(0, 7);
      const cur = map.get(key) ?? { cabezas: 0, monto: 0 };
      cur.cabezas += v.cabezas;
      cur.monto   += v.monto;
      map.set(key, cur);
    });
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, v]) => {
        const [y, m] = key.split('-');
        const idx = Math.max(0, Math.min(11, parseInt(m ?? '1', 10) - 1));
        return { mes: `${MESES[idx]} ${(y ?? '').slice(2)}`, cabezas: v.cabezas, monto: v.monto };
      });
  }, [filtradas]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventas"
        subtitle="Salidas de hacienda — cabezas vendidas a frigorífico, remates u otros productores."
        count={{ value: filtradas.length, label: 'ventas' }}
        lastDate={kpis.fechaUltima !== '—' ? kpis.fechaUltima : undefined}
        actions={
          <ExportCsvButton
            onClick={() => exportVentas(filtradas)}
            disabled={filtradas.length === 0}
            count={filtradas.length}
          />
        }
      />

      {/* Filtros — rango + año + cliente. Mismo patrón que el resto del
          dashboard. Cuando hay año seteado, los pills de rango quedan opacos. */}
      <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-center gap-3">
        <div className={cn('flex items-center gap-1 flex-wrap', filtrosPeriodo.año != null && 'opacity-40')}>
          <span className="text-xs uppercase font-semibold text-asfion-muted mr-2">Rango</span>
          {([['7d', '7d'], ['30d', '30d'], ['90d', '90d'], ['12m', '12m'], ['todo', 'Todo']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFiltrosPeriodo({ ...filtrosPeriodo, rango: val, año: undefined })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-semibold transition',
                filtrosPeriodo.rango === val && filtrosPeriodo.año == null
                  ? 'bg-asfion-navy text-white'
                  : 'bg-asfion-bg text-asfion-navy hover:bg-asfion-orangeSoft/25',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-8 w-px bg-asfion-borderSoft" />
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-asfion-muted">Año</span>
          <select
            value={filtrosPeriodo.año ?? ''}
            onChange={e => {
              const v = e.target.value;
              setFiltrosPeriodo({ ...filtrosPeriodo, año: v === '' ? undefined : parseInt(v, 10) });
            }}
            className="bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition cursor-pointer"
          >
            <option value="">— Por rango —</option>
            {(añosDisponibles.length > 0 ? añosDisponibles : [new Date().getFullYear()]).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="h-8 w-px bg-asfion-borderSoft" />
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-asfion-muted">Cliente</span>
          <select
            value={cliente}
            onChange={e => setCliente(e.target.value)}
            className="bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition cursor-pointer"
          >
            {clientesUnicos.map(c => (
              <option key={c} value={c}>{c === 'todos' ? 'Todos los clientes' : c}</option>
            ))}
          </select>
        </div>
      </div>

      {ventas.length === 0 ? (
        <Card title="Sin ventas cargadas" subtitle="El módulo todavía no está conectado a la fuente">
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-asfion-orangeSoft flex items-center justify-center">
              <CoinsIcon size={28} className="text-asfion-navyDeep" />
            </div>
            <p className="text-sm font-semibold text-asfion-navy">
              Todavía no hay ventas cargadas.
            </p>
            <p className="text-xs text-asfion-muted max-w-md">
              Cuando se enchufe la fuente (form de venta en app móvil o sync
              periódico de planilla del administrador), acá vas a ver: cabezas
              vendidas · monto recaudado · peso total · precio promedio
              ponderado por kg · ranking por cliente · evolución mensual ·
              tabla detallada de cada venta con frigorífico, categoría,
              precio y observaciones.
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px] uppercase text-asfion-muted">
              <div className="bg-asfion-bg px-3 py-2 rounded-lg border border-asfion-borderSoft">
                <p className="font-bold text-asfion-navyDeep">Cabezas</p>
                <p>SUM(cabezas)</p>
              </div>
              <div className="bg-asfion-bg px-3 py-2 rounded-lg border border-asfion-borderSoft">
                <p className="font-bold text-asfion-navyDeep">Monto</p>
                <p>SUM(monto)</p>
              </div>
              <div className="bg-asfion-bg px-3 py-2 rounded-lg border border-asfion-borderSoft">
                <p className="font-bold text-asfion-navyDeep">$/kg prom</p>
                <p>monto / kg total</p>
              </div>
              <div className="bg-asfion-bg px-3 py-2 rounded-lg border border-asfion-borderSoft">
                <p className="font-bold text-asfion-navyDeep">Top cliente</p>
                <p>Ranking $</p>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Kpi
              label="Cabezas vendidas"
              value={formatNumber(kpis.cabezas)}
              accent="orange"
              icon={<UsersIcon size={18} />}
            />
            <Kpi
              label="Monto"
              value={`$${formatNumber(Math.round(kpis.monto))}`}
              sublabel="Recaudado total"
              accent="orange"
              icon={<CoinsIcon size={18} />}
            />
            <Kpi
              label="Peso total"
              value={`${formatNumber(Math.round(kpis.pesoTotal))} kg`}
              accent="navy"
              icon={<WeightIcon size={18} />}
            />
            <Kpi
              label="$/kg promedio"
              value={kpis.precioPromedio > 0 ? kpis.precioPromedio.toFixed(2) : '—'}
              sublabel="Ponderado por kg"
              accent="navy"
              icon={<TrendingUpIcon size={18} />}
            />
            <Kpi
              label="Última venta"
              value={kpis.fechaUltima}
              accent="terracota"
              icon={<CalendarDaysIcon size={18} />}
            />
          </div>

          {/* Charts */}
          <Card title="Ventas por mes" subtitle="Evolución temporal — cabezas y monto recaudado">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={porMes} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
                <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip />
                <Bar dataKey="cabezas" fill="#FF8409" radius={[4, 4, 0, 0]} name="Cabezas">
                  <LabelList dataKey="cabezas" position="top" fontSize={11} fill="#163349" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Tabla detallada */}
          <Card title="Detalle de ventas" subtitle="Cada venta individual — fecha, cliente, cabezas, peso, precio">
            <VentasTabla rows={filtradas} />
          </Card>
        </>
      )}
    </div>
  );
}

// === Tabla detallada ===

function VentasTabla({ rows }: { rows: Venta[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-asfion-muted py-6 text-center italic">Sin ventas con los filtros aplicados.</p>;
  }
  const ordenadas = [...rows].sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
            <th className="py-2 px-2 font-semibold whitespace-nowrap">Fecha</th>
            <th className="py-2 px-2 font-semibold whitespace-nowrap">Cliente</th>
            <th className="py-2 px-2 font-semibold whitespace-nowrap">Categoría</th>
            <th className="py-2 px-2 font-semibold text-right tabular-nums whitespace-nowrap">Cabezas</th>
            <th className="py-2 px-2 font-semibold text-right tabular-nums whitespace-nowrap">Peso (kg)</th>
            <th className="py-2 px-2 font-semibold text-right tabular-nums whitespace-nowrap">$/kg</th>
            <th className="py-2 px-2 font-semibold text-right tabular-nums whitespace-nowrap">Monto</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map(v => (
            <tr key={v.id} className="border-b border-asfion-borderSoft/50 hover:bg-asfion-bg/60 transition">
              <td className="py-2 px-2 tabular-nums text-asfion-navy whitespace-nowrap">{v.fecha}</td>
              <td className="py-2 px-2 font-semibold text-asfion-navyDeep">{v.cliente}</td>
              <td className="py-2 px-2 text-asfion-muted">{v.categoria}</td>
              <td className="py-2 px-2 tabular-nums text-right">{formatNumber(v.cabezas)}</td>
              <td className="py-2 px-2 tabular-nums text-right">{formatNumber(Math.round(v.pesoTotal))}</td>
              <td className="py-2 px-2 tabular-nums text-right">{v.precioPorKg.toFixed(2)}</td>
              <td className="py-2 px-2 tabular-nums text-right font-bold text-asfion-orange">
                ${formatNumber(Math.round(v.monto))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Export CSV de Ventas — un row por venta filtrada (período + cliente).
function exportVentas(rows: Venta[]): void {
  const cols: CsvColumn<Venta>[] = [
    { header: 'Fecha',         value: r => r.fecha },
    { header: 'Cliente',       value: r => r.cliente },
    { header: 'Campo',         value: r => r.campo ?? '' },
    { header: 'Categoría',     value: r => r.categoria },
    { header: 'Cabezas',       value: r => r.cabezas },
    { header: 'Peso total',    value: r => r.pesoTotal },
    { header: 'Precio $/kg',   value: r => r.precioPorKg },
    { header: 'Monto',         value: r => r.monto },
    { header: 'Observaciones', value: r => r.observaciones ?? '' },
  ];
  const csv = rowsToCsv(rows, cols);
  void downloadCsv(csv, csvFilename('ventas'));
}
