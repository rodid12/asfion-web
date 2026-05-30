// Botón compartido de "Exportar CSV" — un solo lugar para mantener look,
// tamaño y disabled-state coherentes entre los 4 módulos del dashboard.
//
// El caller arma el CSV (con rowsToCsv) y le pasa un onClick — el botón
// no sabe nada del shape de los datos, solo de pintar el botón y
// deshabilitarse cuando no hay nada que exportar.

import React from 'react';
import { DownloadIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  onClick: () => void;
  disabled?: boolean;
  /** Cantidad de filas que se van a exportar — se muestra entre paréntesis. */
  count?: number;
}

export function ExportCsvButton({ onClick, disabled, count }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition',
        disabled
          ? 'bg-asfion-borderSoft text-asfion-muted cursor-not-allowed'
          : 'bg-asfion-dark text-white hover:bg-asfion-deep',
      )}
      title="Descargar CSV con los datos filtrados"
    >
      <DownloadIcon size={14} />
      Exportar CSV
      {typeof count === 'number' && count > 0 && (
        <span className="text-xs opacity-80 tabular-nums">({count})</span>
      )}
    </button>
  );
}
