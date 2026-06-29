import clsx from 'clsx';

export function cn(...inputs: Array<string | undefined | false | null>) {
  return clsx(...inputs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters — instanciamos UN solo Intl.NumberFormat por configuración y
// reutilizamos. Antes formatNumber creaba un new Intl.NumberFormat() por cada
// llamada; con ResumenServicioTable (50 filas × 8 cols = 400 instancias por
// render) era ~15-25ms gastados en construir el formatter cada vez.
// ─────────────────────────────────────────────────────────────────────────────
const NF_INT = new Intl.NumberFormat('es-AR');

export function formatNumber(n: number): string {
  return NF_INT.format(n);
}

// formatPercent NO usa Intl (string.toFixed es barato) pero centralizamos
// el patrón por consistencia. Cache por cantidad de decimales para evitar
// recrear si en el futuro mezclamos formatters.
const NF_PCT_CACHE = new Map<number, (n: number) => string>();
export function formatPercent(n: number, decimals = 1): string {
  let fn = NF_PCT_CACHE.get(decimals);
  if (!fn) {
    fn = (x: number) => `${(x * 100).toFixed(decimals)}%`;
    NF_PCT_CACHE.set(decimals, fn);
  }
  return fn(n);
}
