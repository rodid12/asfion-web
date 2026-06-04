// Tabs de módulos en el header del Dashboard.
//
// El estado vive en el Dashboard padre. Acá solo renderizamos botones,
// los counters opcionales muestran cuántos eventos hay totales por tipo.

import React from 'react';
import { clsx } from 'clsx';

export type ModuleKey = 'pariciones' | 'lluvias' | 'mortandad' | 'pastoreo' | 'compras' | 'corrales';

interface Props {
  active: ModuleKey;
  onChange: (k: ModuleKey) => void;
  counts?: Partial<Record<ModuleKey, number>>;
}

// `disabled` marca tabs teaser (módulos en roadmap, todavía no implementados).
// Aparecen como un tab más con label opaco y chip "PRÓXIMAMENTE" — no son
// clickeables. Cuando el módulo se implementa, quitar el flag y enchufar la
// página correspondiente en Dashboard.tsx.
const TABS: { key: ModuleKey | 'ventas'; label: string; disabled?: boolean }[] = [
  { key: 'pariciones', label: 'Pariciones' },
  { key: 'lluvias',    label: 'Lluvias'    },
  { key: 'mortandad',  label: 'Mortandad'  },
  { key: 'pastoreo',   label: 'Pastoreo'   },
  { key: 'compras',    label: 'Compras'    },
  { key: 'corrales',   label: 'Corrales'   },
  { key: 'ventas',     label: 'Ventas',    disabled: true },
];

export function ModuleTabs({ active, onChange, counts }: Props) {
  return (
    <div className="border-b border-asfion-borderSoft bg-white">
      <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
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
    </div>
  );
}
