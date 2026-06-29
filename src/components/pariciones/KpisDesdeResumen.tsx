// =============================================================================
// KpisDesdeResumen — grid de KPIs cuando hay resumen del servicio cargado
// =============================================================================
//
// Renderiza los 9 KPIs (4 + 4) + 5 mini-KPIs (% eficiencia) usando las
// fórmulas LITERALES del Excel del cliente (pariciones_resumen_servicio).
// Es la fuente preferida — cuando el cliente carga el cierre anual, este
// componente reemplaza al KpisLegacy.
//
// Pure presentational — recibe los totales ya calculados (computeResumenTotales).

import React from 'react';
import {
  BabyIcon, ShieldOffIcon, SkullIcon, UsersIcon, WarehouseIcon,
} from 'lucide-react';
import { Kpi } from '@/components/Kpi';
import { MiniKpi } from '@/components/MiniKpi';
import { formatNumber, formatPercent } from '@/lib/utils';
import type { ResumenTotales } from './computeResumenTotales';

interface Props {
  totales: ResumenTotales;
}

export function KpisDesdeResumen({ totales }: Props) {
  return (
    <>
      {/* Fila A — 4 KPIs grandes con el cierre del servicio del Excel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label="Preñadas"
          value={formatNumber(totales.prenadas)}
          sublabel={`Servicio ${totales.anio} · ${totales.tropas} tropas`}
          accent="navy"
          icon={<WarehouseIcon size={18} />}
        />
        <Kpi
          label="Vacas durante servicio"
          value={formatNumber(totales.vacasDuranteServ)}
          sublabel={`Preñadas − ${formatNumber(totales.mortVientres)} mort. vientres`}
          accent="navy"
          icon={<ShieldOffIcon size={18} />}
        />
        <Kpi
          label="Terneros nacidos"
          value={formatNumber(totales.nacidos)}
          sublabel={`Merma TR-parición: ${formatPercent(totales.mermaTrParicion)}`}
          accent="orange"
          icon={<BabyIcon size={18} />}
        />
        <Kpi
          label="Terneros vivos"
          value={formatNumber(totales.vivos)}
          sublabel={
            `${formatNumber(totales.nacidos)} nacidos − ` +
            `${formatNumber(totales.mortTernSenal)} señalados − ` +
            `${formatNumber(totales.recuentoSalida)} recuento`
          }
          accent="orange"
          icon={<UsersIcon size={18} />}
        />
      </div>

      {/* Fila B — Mortandades desglosadas como en el Excel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label="Mortandad vientres"
          value={formatNumber(totales.mortVientres)}
          sublabel="Vacas muertas durante servicio"
          accent="terracota"
          icon={<SkullIcon size={18} />}
        />
        <Kpi
          label="NPT y abortos"
          value={formatNumber(totales.nptAbortos)}
          sublabel="Diagnosticados al retacto"
          accent="terracota"
          icon={<SkullIcon size={18} />}
        />
        <Kpi
          label="Mort. tern. señalados"
          value={formatNumber(totales.mortTernSenal)}
          sublabel="Terneros señalados muertos"
          accent="terracota"
          icon={<SkullIcon size={18} />}
        />
        <Kpi
          label="Mort. tern. sin señalar"
          value={formatNumber(totales.mortTernSinSen)}
          sublabel={`+ ${formatNumber(totales.recuentoSalida)} faltantes al recuento`}
          accent="terracota"
          icon={<SkullIcon size={18} />}
        />
      </div>

      {/* Fila C — % de eficiencia, fórmulas del Excel literal */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniKpi
          label="% Destete sobre Preñ."
          value={formatPercent(totales.pctDesteteSobrePren)}
          accent="orange"
        />
        <MiniKpi
          label="% Abortos y NPT"
          value={formatPercent(totales.pctAbortosNpt)}
          accent="terracota"
        />
        <MiniKpi
          label="% Mort. vientres"
          value={formatPercent(totales.pctMortVientres)}
          accent="terracota"
        />
        <MiniKpi
          label="% Mort. señalados"
          value={formatPercent(totales.pctMortTernSenal)}
          accent="terracota"
        />
        <MiniKpi
          label="% Mort. sin señalar"
          value={formatPercent(totales.pctMortTernSinSen)}
          accent="danger"
        />
      </div>
    </>
  );
}
