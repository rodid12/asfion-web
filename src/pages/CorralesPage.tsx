// Página del módulo Cierre de Corrales — réplica de la página 6 del Power BI.
//
// Trackea performance de animales en encerrado/feedlot: pesos de inicio y
// fin de tropa, días de duración, EC (eficiencia conversión), CMS (consumo
// materia seca % peso vivo), ADPV (aumento diario peso vivo), costo de
// ración. Sirve para comparar tropas entre sí y tomar decisión de cuándo
// cerrar / qué tropas siguen.
//
// Estado actual: la data hoy vive en Google Sheets (carga del encargado de
// feedlot). La UI está armada con empty state — cuando definamos la fuente
// (Ruta A: app móvil con form propio · Ruta B: sync periódico de Sheets),
// recibe el array `corrales` poblado y todo renderea automático.

import React, { useMemo, useState } from 'react';
import {
  ActivityIcon,
  CoinsIcon,
  ScaleIcon,
  TrendingUpIcon,
  UsersIcon,
} from 'lucide-react';
import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import { PageHeader } from '@/components/PageHeader';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { formatNumber } from '@/lib/utils';

/**
 * Shape de un row de cierre de corral. Cuando se enchufe la fuente real,
 * exportar esta interfaz desde data/types.ts y reemplazar en la prop.
 */
export interface Corral {
  id: string;
  etapa: 'Re Cría' | 'Terminación';
  categoria: 'Novillo' | 'Vaquillona';
  tropa: string;
  pesoInicial: number;
  pesoFinal: number;
  duracionDias: number;
  ecPromedio: number;          // EC kg/kg
  cmsPctPv: number;            // CMS % peso vivo
  cmsKgPorDia: number;         // CMS kg/an/día
  adpv: number;                // kg/an/día
  alimPesoProducido: number;   // $/kg prod
  racionPesoMs: number;        // $/kg MS
  animales: number;
}

interface Props {
  /** Cierres de corral cargados. Por ahora siempre vacío; cuando enchufemos
   *  la fuente, se llena desde el server. */
  corrales?: Corral[];
}

const ETAPAS: Array<Corral['etapa'] | 'todas'> = ['todas', 'Re Cría', 'Terminación'];
const CATEGORIAS: Array<Corral['categoria'] | 'todas'> = ['todas', 'Novillo', 'Vaquillona'];

export function CorralesPage({ corrales = [] }: Props) {
  const [etapa, setEtapa] = useState<Corral['etapa'] | 'todas'>('Re Cría');
  const [categoria, setCategoria] = useState<Corral['categoria'] | 'todas'>('Novillo');
  const [tropa, setTropa] = useState<string>('todas');

  const tropasUnicas = useMemo(() => {
    const s = new Set(corrales.map(c => c.tropa));
    return ['todas', ...Array.from(s).sort()];
  }, [corrales]);

  const filtrados = useMemo(() => {
    return corrales.filter(c => {
      if (etapa !== 'todas' && c.etapa !== etapa) return false;
      if (categoria !== 'todas' && c.categoria !== categoria) return false;
      if (tropa !== 'todas' && c.tropa !== tropa) return false;
      return true;
    });
  }, [corrales, etapa, categoria, tropa]);

  // KPIs globales — réplica del Power BI:
  //   Animales, Kg Prod Total, Kg Producidos (por animal),
  //   ADPV(kg/an/día), EC Kg/Kg, CMS (% PV), $ Ración Prom.
  const kpis = useMemo(() => {
    const n = filtrados.length;
    if (n === 0) {
      return {
        animales: 0, kgProdTotal: 0, kgProducidos: 0,
        adpv: 0, ecPromedio: 0, cmsPctPv: 0, racionProm: 0,
      };
    }
    let animales = 0, kgProdTotal = 0;
    let sumAdpv = 0, sumEc = 0, sumCms = 0, sumRacion = 0;
    filtrados.forEach(c => {
      animales += c.animales;
      kgProdTotal += (c.pesoFinal - c.pesoInicial) * c.animales;
      sumAdpv += c.adpv;
      sumEc += c.ecPromedio;
      sumCms += c.cmsPctPv;
      sumRacion += c.racionPesoMs;
    });
    return {
      animales,
      kgProdTotal,
      kgProducidos: animales > 0 ? kgProdTotal / animales : 0,
      adpv: sumAdpv / n,
      ecPromedio: sumEc / n,
      cmsPctPv: sumCms / n,
      racionProm: sumRacion / n,
    };
  }, [filtrados]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cierre de Corrales"
        subtitle="Performance de tropas en encerrado — pesos, conversión, ADPV y costo de ración."
        count={{ value: filtrados.length, label: 'tropas' }}
        actions={
          <ExportCsvButton
            onClick={() => {/* TODO */}}
            disabled={filtrados.length === 0}
            count={filtrados.length}
          />
        }
      />

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-4 flex flex-wrap items-center gap-4">
        <FilterGroup label="Etapa">
          {ETAPAS.map(e => (
            <FilterChip
              key={e}
              active={etapa === e}
              onClick={() => setEtapa(e)}
              label={e === 'todas' ? 'Todas' : e}
            />
          ))}
        </FilterGroup>
        <div className="h-8 w-px bg-asfion-borderSoft" />
        <FilterGroup label="Categoría">
          {CATEGORIAS.map(c => (
            <FilterChip
              key={c}
              active={categoria === c}
              onClick={() => setCategoria(c)}
              label={c === 'todas' ? 'Todas' : c}
            />
          ))}
        </FilterGroup>
        <div className="h-8 w-px bg-asfion-borderSoft" />
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-asfion-muted">Tropa</span>
          <select
            value={tropa}
            onChange={e => setTropa(e.target.value)}
            className="bg-asfion-bg border border-asfion-borderSoft rounded-lg px-3 py-1.5 text-sm font-semibold text-asfion-navy hover:bg-asfion-orangeSoft/25 focus:outline-none focus:ring-2 focus:ring-asfion-orange/40 focus:border-asfion-orange transition cursor-pointer"
          >
            {tropasUnicas.map(t => (
              <option key={t} value={t}>{t === 'todas' ? 'Todas' : t}</option>
            ))}
          </select>
        </div>
      </div>

      {corrales.length === 0 ? (
        <Card title="Sin datos cargados" subtitle="Hoy la fuente de datos todavía no está conectada">
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-asfion-orangeSoft flex items-center justify-center">
              <ActivityIcon size={28} className="text-asfion-navyDeep" />
            </div>
            <p className="text-sm font-semibold text-asfion-navy">
              Todavía no hay cierres de corrales cargados.
            </p>
            <p className="text-xs text-asfion-muted max-w-md">
              Cuando se enchufe la fuente de datos (app móvil con form de cierre
              o sync periódico de Google Sheets), acá vas a ver los 7 KPIs
              globales y la tabla de performance por tropa con todas las
              métricas del Power BI: P. Inicial, P. Final, Duración, EC, CMS,
              ADPV, Alim. ($/kg prod), $ Ración.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* KPIs principales — réplica del Power BI página 6 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi
              label="Animales"
              value={formatNumber(kpis.animales)}
              accent="navy"
              icon={<UsersIcon size={18} />}
            />
            <Kpi
              label="Kg Prod Total"
              value={formatNumber(Math.round(kpis.kgProdTotal))}
              sublabel="(Peso final − Peso inicial) × animales"
              accent="orange"
              icon={<ScaleIcon size={18} />}
            />
            <Kpi
              label="Kg Producidos"
              value={kpis.kgProducidos.toFixed(2)}
              sublabel="Promedio por animal"
              accent="navy"
              icon={<TrendingUpIcon size={18} />}
            />
            <Kpi
              label="$ Ración Prom"
              value={kpis.racionProm.toFixed(2)}
              sublabel="$/kg MS — promedio entre tropas"
              accent="terracota"
              icon={<CoinsIcon size={18} />}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Kpi
              label="ADPV (kg/an/día)"
              value={kpis.adpv.toFixed(2)}
              sublabel="Aumento diario peso vivo"
              accent="orange"
            />
            <Kpi
              label="EC Kg/Kg"
              value={kpis.ecPromedio.toFixed(2)}
              sublabel="Eficiencia de conversión"
              accent="navy"
            />
            <Kpi
              label="CMS (% PV)"
              value={kpis.cmsPctPv.toFixed(2)}
              sublabel="Consumo MS sobre peso vivo"
              accent="navy"
            />
          </div>

          {/* Tabla de performance — replica exacta del Power BI */}
          <Card title="Performance por tropa" subtitle="Métricas detalladas de cada cierre">
            <PerformanceTabla rows={filtrados} />
          </Card>
        </>
      )}
    </div>
  );
}

// === Pequeños helpers de UI compartidos en esta página ===

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs uppercase font-semibold text-asfion-muted mr-2">{label}</span>
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        'px-3 py-1.5 rounded-lg text-sm font-semibold transition ' +
        (active
          ? 'bg-asfion-navy text-white'
          : 'bg-asfion-bg text-asfion-navy hover:bg-asfion-orangeSoft/25')
      }
    >
      {label}
    </button>
  );
}

function PerformanceTabla({ rows }: { rows: Corral[] }) {
  // Total row — promedios ponderados por animales (replica el cálculo del
  // Power BI, donde el footer "Total" muestra las mismas métricas que los
  // KPIs globales). Si una tropa tiene más animales, pesa más en el promedio.
  const totals = React.useMemo(() => {
    if (rows.length === 0) return null;
    const sumA = rows.reduce((s, r) => s + r.animales, 0) || 1;
    const w = <K extends keyof Corral>(k: K) =>
      rows.reduce((s, r) => s + (Number(r[k]) || 0) * r.animales, 0) / sumA;
    return {
      pesoInicial:        w('pesoInicial'),
      pesoFinal:          w('pesoFinal'),
      duracionDias:       w('duracionDias'),
      ecPromedio:         w('ecPromedio'),
      cmsPctPv:           w('cmsPctPv'),
      cmsKgPorDia:        w('cmsKgPorDia'),
      adpv:               w('adpv'),
      alimPesoProducido:  w('alimPesoProducido'),
      racionPesoMs:       w('racionPesoMs'),
    };
  }, [rows]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
            <th className="py-2 px-2 font-semibold">Etapa</th>
            <th className="py-2 px-2 font-semibold">Categoría</th>
            <th className="py-2 px-2 font-semibold">Tropa</th>
            <th className="py-2 px-2 font-semibold tabular-nums">P. Inicial (kg)</th>
            <th className="py-2 px-2 font-semibold tabular-nums">P. Final (kg)</th>
            <th className="py-2 px-2 font-semibold tabular-nums">Duración (días)</th>
            <th className="py-2 px-2 font-semibold tabular-nums">EC Prom</th>
            <th className="py-2 px-2 font-semibold tabular-nums">CMS (% PV)</th>
            <th className="py-2 px-2 font-semibold tabular-nums">CMS (kg/día)</th>
            <th className="py-2 px-2 font-semibold tabular-nums">ADPV</th>
            <th className="py-2 px-2 font-semibold tabular-nums">Alim. ($/kg)</th>
            <th className="py-2 px-2 font-semibold tabular-nums">$ Ración</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-asfion-borderSoft/50 hover:bg-asfion-bg/60 transition">
              <td className="py-2 px-2 text-asfion-muted">{r.etapa}</td>
              <td className="py-2 px-2 text-asfion-muted">{r.categoria}</td>
              <td className="py-2 px-2 font-semibold text-asfion-navyDeep">{r.tropa}</td>
              <td className="py-2 px-2 tabular-nums">{r.pesoInicial.toFixed(2)}</td>
              <td className="py-2 px-2 tabular-nums">{r.pesoFinal.toFixed(2)}</td>
              <td className="py-2 px-2 tabular-nums">{r.duracionDias.toFixed(2)}</td>
              <td className="py-2 px-2 tabular-nums">{r.ecPromedio.toFixed(2)}</td>
              <td className="py-2 px-2 tabular-nums">{r.cmsPctPv.toFixed(2)}</td>
              <td className="py-2 px-2 tabular-nums">{r.cmsKgPorDia.toFixed(2)}</td>
              <td className="py-2 px-2 tabular-nums font-semibold text-asfion-orange">{r.adpv.toFixed(2)}</td>
              <td className="py-2 px-2 tabular-nums">{r.alimPesoProducido.toFixed(2)}</td>
              <td className="py-2 px-2 tabular-nums">{r.racionPesoMs.toFixed(2)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={12} className="py-8 text-center text-asfion-muted italic">
                Sin tropas que coincidan con los filtros.
              </td>
            </tr>
          )}
        </tbody>
        {totals && (
          <tfoot>
            {/* Total row — réplica del footer del Power BI página 6. Promedios
                weighted por la cantidad de animales de cada tropa. */}
            <tr className="border-t-2 border-asfion-navyDeep bg-asfion-bg/40 font-bold">
              <td className="py-3 px-2 text-asfion-navyDeep" colSpan={3}>Total</td>
              <td className="py-3 px-2 tabular-nums text-asfion-navyDeep">{totals.pesoInicial.toFixed(2)}</td>
              <td className="py-3 px-2 tabular-nums text-asfion-navyDeep">{totals.pesoFinal.toFixed(2)}</td>
              <td className="py-3 px-2 tabular-nums text-asfion-navyDeep">{totals.duracionDias.toFixed(2)}</td>
              <td className="py-3 px-2 tabular-nums text-asfion-navyDeep">{totals.ecPromedio.toFixed(2)}</td>
              <td className="py-3 px-2 tabular-nums text-asfion-navyDeep">{totals.cmsPctPv.toFixed(2)}</td>
              <td className="py-3 px-2 tabular-nums text-asfion-navyDeep">{totals.cmsKgPorDia.toFixed(2)}</td>
              <td className="py-3 px-2 tabular-nums text-asfion-orange">{totals.adpv.toFixed(2)}</td>
              <td className="py-3 px-2 tabular-nums text-asfion-navyDeep">{totals.alimPesoProducido.toFixed(2)}</td>
              <td className="py-3 px-2 tabular-nums text-asfion-navyDeep">{totals.racionPesoMs.toFixed(2)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
