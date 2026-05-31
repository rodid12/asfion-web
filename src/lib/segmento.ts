// Segmentación cabeza / cuerpo / cola por FECHA (no por carga manual).
//
// Replica la lógica DAX que usa el cliente final en su Power BI:
//
//   Para campo "Quirquincho":
//     - hasta 15/oct → Cabeza
//     - 16/oct a 15/nov → Cuerpo
//     - desde 16/nov → Cola
//
//   Para el resto de los campos:
//     - hasta 15/nov → Cabeza
//     - 16/nov a 15/dic → Cuerpo
//     - desde 16/dic → Cola
//
// IMPORTANTE: la regla es por mes y día (sin año). El año del evento no
// importa — la "temporada" de pariciones se reparte siempre dentro de la
// misma ventana del calendario.
//
// El campo `vacasGrupo` del form mobile queda como referencia histórica
// (lo que el peón cargó), pero las métricas del dashboard se calculan
// EXCLUSIVAMENTE a partir de la fecha + nombre de campo. Si en algún
// momento queremos volver al field de carga manual, basta cambiar el
// caller de esta función.

export type Segmento = 'Cabeza' | 'Cuerpo' | 'Cola';

const SEGMENTO_ORDEN: Segmento[] = ['Cabeza', 'Cuerpo', 'Cola'];

export { SEGMENTO_ORDEN };

/**
 * Devuelve el segmento (Cabeza / Cuerpo / Cola) según la fecha del evento
 * y el nombre del campo. Mira mes y día — el año se ignora.
 *
 * @param fechaISO string YYYY-MM-DD (formato canon de la app)
 * @param campoNombre nombre del campo (case-insensitive) — solo afecta el
 *                    corte si es "Quirquincho".
 */
export function segmentoPorFecha(fechaISO: string, campoNombre: string): Segmento {
  const [_, mmStr, ddStr] = fechaISO.split('-');
  const m = Number(mmStr);
  const d = Number(ddStr);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return 'Cabeza';

  const esQuirquincho = campoNombre.trim().toLowerCase() === 'quirquincho';
  if (esQuirquincho) {
    // hasta 15/oct → Cabeza
    if (m < 10 || (m === 10 && d <= 15)) return 'Cabeza';
    // 16/oct → 15/nov → Cuerpo
    if (m === 10 || (m === 11 && d <= 15)) return 'Cuerpo';
    // resto → Cola
    return 'Cola';
  }

  // Resto de los campos
  if (m < 11 || (m === 11 && d <= 15)) return 'Cabeza';
  if (m === 11 || (m === 12 && d <= 15)) return 'Cuerpo';
  return 'Cola';
}
