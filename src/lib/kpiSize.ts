// =============================================================================
// kpiSize.ts — Tamaño de fuente adaptativo para tiles con números
// =============================================================================
//
// Garantía: el número SIEMPRE se ve entero en una sola línea, sin importar
// si es "5" o "$2.447.534.343" o "$15.234.567.890". El tamaño se reduce
// en escalones a medida que crece el string, y si llega al mínimo y aun
// así no entra, `overflow-hidden text-ellipsis` recorta con "..." en
// lugar de partir en dos líneas (ilegible).
//
// Los thresholds están calibrados con la grilla del dashboard:
//   - Kpi grande:  card ~220px ancho en desktop, ~170px mobile (2 cols)
//   - Kpi mini:    card ~140px ancho en desktop (6 cols)
//
// Regla mnemotécnica: cada bucket suma ~3 caracteres respecto al anterior.

/**
 * Devuelve las clases Tailwind de tamaño según el largo del value.
 *
 * @param value  string o number — se convierte a string para medir longitud.
 * @param size   'kpi' (default, tile grande) o 'mini' (tile compacto).
 */
export function kpiValueClass(value: string | number, size: 'kpi' | 'mini' = 'kpi'): string {
  const len = String(value).length;
  if (size === 'mini') {
    return (
      len <= 5  ? 'text-xl sm:text-2xl' :
      len <= 8  ? 'text-lg sm:text-xl'  :
      len <= 11 ? 'text-base sm:text-lg':
      len <= 14 ? 'text-sm sm:text-base':
                  'text-xs sm:text-sm'
    );
  }
  // Tile grande (Kpi). Bucket extra (text-sm) para soportar números
  // tipo "$15.234.567.890" (15 chars) sin partir.
  return (
    len <= 7   ? 'text-2xl sm:text-3xl lg:text-4xl' :
    len <= 10  ? 'text-xl sm:text-2xl lg:text-3xl'  :
    len <= 13  ? 'text-lg sm:text-xl lg:text-2xl'   :
    len <= 16  ? 'text-base sm:text-lg lg:text-xl'  :
                 'text-sm sm:text-base lg:text-lg'
  );
}

/**
 * Clases base para CUALQUIER tile con número grande. Combinar con
 * kpiValueClass() + el color de acento. Garantiza:
 *   - font-extrabold tabular-nums  (típico de KPIs)
 *   - whitespace-nowrap            (NUNCA partir en líneas)
 *   - overflow-hidden text-ellipsis (recortar con "..." si no entra)
 *   - leading-tight                (no apretar tipográficamente)
 */
export const KPI_VALUE_BASE =
  'font-extrabold tabular-nums whitespace-nowrap overflow-hidden text-ellipsis leading-tight';

/**
 * Heurística para decidir si poner title tooltip — solo si la reducción
 * fue significativa y el usuario podría querer ver el value completo en
 * hover. Threshold conservador (10+ chars).
 */
export function kpiTitleAttr(value: string | number): string | undefined {
  const s = String(value);
  return s.length > 10 ? s : undefined;
}
