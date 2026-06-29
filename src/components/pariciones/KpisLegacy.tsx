// =============================================================================
// KpisLegacy — grid de KPIs cuando NO hay resumen del servicio cargado
// =============================================================================
//
// Render de los 14 KPIs DAX desde eventos individuales — fallback de la
// página Pariciones para clientes que todavía no cargaron el cierre anual.
//
// Recibe `kpis` ya calculado por computeKpisLegacy (función pura). Si en
// algún momento se quiere mostrar este grid Y el resumen al mismo tiempo
// (para comparar dashboard vs Excel), basta con calcular ambos y renderear
// los dos componentes.

import React from 'react';
import {
  BabyIcon, HeartCrackIcon, ShieldOffIcon, SkullIcon, TrendingUpIcon,
  UsersIcon, WarehouseIcon,
} from 'lucide-react';
import { Kpi } from '@/components/Kpi';
import { MiniKpi } from '@/components/MiniKpi';
import { formatNumber, formatPercent } from '@/lib/utils';
import type { KpisLegacy as KpisLegacyType } from './computeKpisLegacy';

interface Props {
  kpis: KpisLegacyType;
}

export function KpisLegacy({ kpis }: Props) {
  return (
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
  );
}
