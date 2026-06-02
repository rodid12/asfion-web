// Tabs de módulos en el header del Dashboard.
//
// El estado vive en el Dashboard padre. Acá solo renderizamos botones,
// los counters opcionales muestran cuántos eventos hay totales por tipo.

import React from 'react';
import { clsx } from 'clsx';

export type ModuleKey = 'pariciones' | 'lluvias' | 'mortandad' | 'pastoreo' | 'compras';

interface Props {
  active: ModuleKey;
  onChange: (k: ModuleKey) => void;
  counts?: Partial<Record<ModuleKey, number>>;
}

const TABS: { key: ModuleKey; label: string }[] = [
  { key: 'pariciones', label: 'Pariciones' },
  { key: 'lluvias',    label: 'Lluvias'    },
  { key: 'mortandad',  label: 'Mortandad'  },
  { key: 'pastoreo',   label: 'Pastoreo'   },
  { key: 'compras',    label: 'Compras'    },
];

export function ModuleTabs({ active, onChange, counts }: Props) {
  return (
    <div className="border-b border-asfion-borderSoft bg-white">
      <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => {
          const isActive = t.key === active;
          const n = counts?.[t.key];
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={clsx(
                'px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition whitespace-nowrap',
                isActive
                  ? 'border-asfion-dark text-asfion-deep'
                  : 'border-transparent text-asfion-muted hover:text-asfion-dark hover:bg-asfion-bg',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {t.label}
              {typeof n === 'number' && n > 0 && (
                <span
                  className={clsx(
                    'ml-2 inline-block min-w-[1.5rem] px-1.5 text-xs font-bold rounded-full',
                    isActive ? 'bg-asfion-lime text-asfion-deep' : 'bg-asfion-borderSoft text-asfion-muted',
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
