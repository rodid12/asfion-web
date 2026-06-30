// Utilidades de manejo de fechas — TZ safe.
//
// Bug que motivó este archivo: hacer `new Date('2026-01-15')` parsea en
// UTC midnight, mientras que `new Date('2026-01-15T00:00:00')` parsea
// en local midnight. Después llamar `.toISOString().slice(0, 10)` siempre
// devuelve la fecha UTC, así que un evento cargado el 15 a las 22:00 en
// Argentina (UTC-3) → 16 en UTC → el chart lo cuenta como del día 16.
//
// Resultado en la práctica: charts de "Evolución diaria" mostraban
// eventos corridos un día en mortandad, lluvia, pastoreo.
//
// La regla: para trabajar con fechas ISO "YYYY-MM-DD" sin la dimensión
// horaria, NUNCA usamos Date.toISOString() ni Date.toString() para
// volver al string. Hacemos parsing/formato manual respetando local.

/** Convierte una fecha ISO `YYYY-MM-DD` en un Date local midnight. */
export function fechaISOaLocal(iso: string): Date {
  // Forzar interpretación en local timezone con T00:00:00. Sin sufijo Z.
  return new Date(iso + 'T00:00:00');
}

/** Convierte un Date a string ISO `YYYY-MM-DD` usando la zona local
 *  (NO UTC). Esto es lo que reemplaza al `toISOString().slice(0, 10)`
 *  que tenía el bug. */
export function dateAISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Suma N días a una fecha ISO `YYYY-MM-DD` y devuelve la nueva fecha ISO. */
export function sumarDiasISO(iso: string, dias: number): string {
  const d = fechaISOaLocal(iso);
  d.setDate(d.getDate() + dias);
  return dateAISO(d);
}

/** Cuenta los días entre dos fechas ISO (hasta - desde, inclusivo en desde). */
export function diasEntreISO(desde: string, hasta: string): number {
  const a = fechaISOaLocal(desde);
  const b = fechaISOaLocal(hasta);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const MESES_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/** Formato corto para mostrar en KPI tiles: "31 May 2026" (11 chars).
 *  Más compacto que ISO "2026-05-31" pero conserva el año completo.
 *  Cae en bucket text-2xl de kpiValueClass — entra bien en tiles
 *  estrechos (grid de 5+ columnas). Devuelve '—' si iso es falsy o
 *  no parseable. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso || iso === '—') return '—';
  const d = fechaISOaLocal(iso);
  if (Number.isNaN(d.getTime())) return iso; // fallback: devolvemos el string original
  const dd = String(d.getDate()).padStart(2, '0');
  const mes = MESES_ABBR[d.getMonth()];
  return `${dd} ${mes} ${d.getFullYear()}`;
}
