import clsx from 'clsx';

export function cn(...inputs: Array<string | undefined | false | null>) {
  return clsx(...inputs);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-AR').format(n);
}

export function formatPercent(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}
