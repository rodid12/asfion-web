// Módulo Pastoreo con sub-navegación interna.
//
// Conceptualmente, todo lo que pasa entre el campo y el corral es "manejo
// del pastoreo": cuando un grupo entra a una parcela, cuando se rota, y
// finalmente cuando se cierra un corral de feedlot. Por eso agrupamos:
//
//   Pastoreo (general)  — vista global + sección Entradas embebida abajo
//   Cierre Corrales     — performance de tropas en feedlot
//
// Las "Entradas" del Power BI se renderizan dentro de la vista Pastoreo
// como una sección más (no una sub-tab) — Agus prefiere verlas juntas
// con el resto de las métricas de pastoreo. Por eso PastoreoEntradasView
// se monta adentro de PastoreoPage con embedded=true.

import React, { useState } from 'react';
import { clsx } from 'clsx';
import type { Campo, Circuito, Pastoreo } from '@/data/types';
import { PastoreoPage } from './PastoreoPage';
import { CorralesPage } from './CorralesPage';

type SubTab = 'pastoreo' | 'corrales';

interface Props {
  pastoreo: Pastoreo[];
  campos: Campo[];
  circuitos: Circuito[];
}

const SUB_TABS: { key: SubTab; label: string; count?: (p: Props) => number }[] = [
  { key: 'pastoreo', label: 'Pastoreo',        count: p => p.pastoreo.length },
  // Corrales: por ahora el data viene vacío (la fuente todavía no está
  // conectada — Sheets / app móvil). Sin count.
  { key: 'corrales', label: 'Cierre Corrales' },
];

export function PastoreoModule(props: Props) {
  const [subTab, setSubTab] = useState<SubTab>('pastoreo');

  return (
    <div className="space-y-6">
      {/* Barra de sub-tabs — visualmente más liviana que ModuleTabs, para
          marcar que es navegación secundaria. Pill-style en bg blanco. */}
      <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-1.5 flex gap-1 overflow-x-auto overflow-y-hidden touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SUB_TABS.map(t => {
          const isActive = t.key === subTab;
          const n = t.count?.(props);
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={clsx(
                'flex-1 min-w-[120px] px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap',
                isActive
                  ? 'bg-asfion-navyDeep text-white shadow-sm'
                  : 'text-asfion-muted hover:text-asfion-navyDeep hover:bg-asfion-orangeSoft/30',
              )}
            >
              {t.label}
              {typeof n === 'number' && n > 0 && (
                <span
                  className={clsx(
                    'ml-2 inline-block min-w-[1.5rem] px-1.5 text-[10px] font-bold rounded-full tabular-nums',
                    isActive ? 'bg-asfion-orange text-asfion-navyDeep' : 'bg-asfion-borderSoft text-asfion-muted',
                  )}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Vista activa — cada sub-componente renderea su propio PageHeader,
          filtros y contenido. Reutilizamos las pages existentes tal cual,
          sin tocarles la estructura interna. La sección "Entradas" se
          renderiza embebida dentro de PastoreoPage (no es sub-tab). */}
      {subTab === 'pastoreo' && (
        <PastoreoPage pastoreo={props.pastoreo} campos={props.campos} circuitos={props.circuitos} />
      )}
      {subTab === 'corrales' && (
        // corrales=[] hasta que se conecte la fuente — el empty state vive
        // adentro de CorralesPage. Conservamos exactamente el mismo render.
        <CorralesPage corrales={[]} />
      )}
    </div>
  );
}
