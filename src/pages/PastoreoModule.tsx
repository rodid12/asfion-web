// Módulo Pastoreo con sub-navegación interna.
//
// Conceptualmente, todo lo que pasa entre el campo y el corral es "manejo
// del pastoreo": cuando un grupo entra a una parcela, cuando se rota, y
// finalmente cuando se cierra un corral de feedlot. Por eso agrupamos:
//
//   Pastoreo (general)  — vista global de stays / circuitos / KG
//   Entradas            — eventos de entrada / rotación con detalle por movida
//   Cierre Corrales     — performance de tropas en feedlot
//
// El menú top-level (ModuleTabs) tiene solo "Pastoreo". Adentro, una barra
// de sub-tabs deja saltar entre las 3 vistas sin perder el contexto del
// módulo. State local — no usamos router porque el dashboard es single-page.

import React, { useState } from 'react';
import { clsx } from 'clsx';
import type { Campo, Circuito, Pastoreo } from '@/data/types';
import { PastoreoPage } from './PastoreoPage';
import { CorralesPage } from './CorralesPage';
import { PastoreoEntradasView } from './PastoreoEntradasView';

type SubTab = 'pastoreo' | 'entradas' | 'corrales';

interface Props {
  pastoreo: Pastoreo[];
  campos: Campo[];
  circuitos: Circuito[];
}

const SUB_TABS: { key: SubTab; label: string; count?: (p: Props) => number }[] = [
  { key: 'pastoreo', label: 'Pastoreo',        count: p => p.pastoreo.length },
  // Entradas filtra movimientos con evento "Entrada" o "Rotacion" sobre el
  // mismo dataset de pastoreo — el count refleja eso.
  { key: 'entradas', label: 'Entradas',        count: p => p.pastoreo.filter(x => isEntradaOrRotacion(x.evento)).length },
  // Corrales: por ahora el data viene vacío (la fuente todavía no está
  // conectada — Sheets / app móvil). Sin count.
  { key: 'corrales', label: 'Cierre Corrales' },
];

function isEntradaOrRotacion(evento?: string): boolean {
  if (!evento) return false;
  const e = evento.toLowerCase();
  return e === 'entrada' || e === 'rotacion' || e === 'rotación';
}

export function PastoreoModule(props: Props) {
  const [subTab, setSubTab] = useState<SubTab>('pastoreo');

  return (
    <div className="space-y-6">
      {/* Barra de sub-tabs — visualmente más liviana que ModuleTabs, para
          marcar que es navegación secundaria. Pill-style en bg blanco. */}
      <div className="bg-white rounded-2xl border border-asfion-borderSoft shadow-card p-1.5 flex gap-1 overflow-x-auto">
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
          sin tocarles la estructura interna. */}
      {subTab === 'pastoreo' && (
        <PastoreoPage pastoreo={props.pastoreo} campos={props.campos} circuitos={props.circuitos} />
      )}
      {subTab === 'entradas' && (
        <PastoreoEntradasView pastoreo={props.pastoreo} campos={props.campos} circuitos={props.circuitos} />
      )}
      {subTab === 'corrales' && (
        // corrales=[] hasta que se conecte la fuente — el empty state vive
        // adentro de CorralesPage. Conservamos exactamente el mismo render.
        <CorralesPage corrales={[]} />
      )}
    </div>
  );
}
