// Tabs de módulos en el header del Dashboard.
//
// El estado vive en el Dashboard padre. Acá solo renderizamos botones,
// los counters opcionales muestran cuántos eventos hay totales por tipo.

import React from 'react';
import { clsx } from 'clsx';

// Corrales fue absorbido como sub-tab dentro de Pastoreo (junto con
// "Entradas") — no aparece más como tab principal. Ventas es un módulo
// nuevo separado de Compras (compras = entradas de hacienda al sistema,
// ventas = salidas / cabezas vendidas a frigorífico u otro productor).
export type ModuleKey = 'pariciones' | 'lluvias' | 'mortandad' | 'pastoreo' | 'compras' | 'ventas' | 'prenez' | 'ndvi';

interface Props {
  active: ModuleKey;
  onChange: (k: ModuleKey) => void;
  counts?: Partial<Record<ModuleKey, number>>;
}

// `disabled` marca tabs teaser (módulos en roadmap, todavía no implementados).
// Aparecen como un tab más con label opaco y chip "PRÓXIMAMENTE" — no son
// clickeables. Cuando el módulo se implementa, quitar el flag y enchufar la
// página correspondiente en Dashboard.tsx.
const TABS: { key: ModuleKey; label: string; disabled?: boolean }[] = [
  { key: 'pariciones', label: 'Pariciones' },
  { key: 'lluvias',    label: 'Lluvias'    },
  { key: 'mortandad',  label: 'Mortandad'  },
  { key: 'pastoreo',   label: 'Pastoreo'   },
  { key: 'ndvi',       label: 'NDVI / MS'  },
  { key: 'compras',    label: 'Compras'    },
  { key: 'ventas',     label: 'Ventas'     },
  { key: 'prenez',     label: 'Preñez'     },
];

export function ModuleTabs({ active, onChange, counts }: Props) {
  return (
    <div className="border-b border-asfion-borderSoft bg-white relative">
      {/* overflow-x-auto + overflow-y-hidden: por spec CSS, setear
          overflow-x: auto convierte overflow-y a auto también (= ambos
          scrolls aparecen). Lo forzamos a y-hidden para que solo scrollee
          horizontal cuando los tabs no entran en mobile.
          touch-action: pan-x deja claro al browser que esta zona acepta
          swipe horizontal por touch — sin esto, swipes que arrancan
          horizontal pero curvan a vertical generan ambigüedad en algunos
          Android y bloquean el scroll.
          [&::-webkit-scrollbar]:hidden + scrollbar-width:none ocultan
          la scrollbar visualmente (queda funcional en touch). */}
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto overflow-y-hidden touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map(t => {
          const isActive = !t.disabled && t.key === active;
          const n = !t.disabled ? counts?.[t.key as ModuleKey] : undefined;
          return (
            <button
              key={t.key}
              onClick={() => !t.disabled && onChange(t.key as ModuleKey)}
              disabled={t.disabled}
              className={clsx(
                'px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition whitespace-nowrap',
                // Tab activa: underline en orange (acento del brand) + texto navy fuerte.
                // Hover en inactivas: tinte peach suave para warmth, no gris frío.
                // Tab disabled (teaser): opaca, sin hover, sin cursor pointer.
                t.disabled
                  ? 'border-transparent text-asfion-muted/60 cursor-not-allowed'
                  : isActive
                    ? 'border-asfion-orange text-asfion-navyDeep'
                    : 'border-transparent text-asfion-muted hover:text-asfion-navyDeep hover:bg-asfion-orangeSoft/25',
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={t.disabled || undefined}
            >
              {t.label}
              {t.disabled && (
                <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-asfion-orangeSoft text-asfion-navyDeep tracking-wide">
                  PRÓXIMAMENTE
                </span>
              )}
              {typeof n === 'number' && n > 0 && (
                <span
                  className={clsx(
                    'ml-2 inline-block min-w-[1.5rem] px-1.5 text-xs font-bold rounded-full',
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
      {/* Fade gradient en el borde derecho — solo visible en mobile como
          hint de "hay más tabs a la derecha". `pointer-events-none` para
          que no interfiera con los clicks sobre los tabs cercanos. */}
      <div
        aria-hidden
        className="sm:hidden absolute right-0 top-0 bottom-0 w-8 pointer-events-none"
        style={{
          background: 'linear-gradient(to left, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
        }}
      />
    </div>
  );
}
