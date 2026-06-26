// Filtros compartidos entre todos los charts. El Dashboard es el dueño del
// estado; cada chart lee la data YA filtrada que le pasan por props.

import type { EventoParicion, Paricion } from './types';

export type RangoFecha = '7d' | '30d' | '90d' | '12m' | 'todo';

export interface Filtros {
  rango: RangoFecha;
  campoId: string | 'todos';
  evento: EventoParicion | 'todos';
  /** Año específico (YYYY). Si está seteado, anula `rango` —
   *  filtra de Jan 1 a Dec 31 de ese año. Mismo patrón que SimpleFiltros. */
  año?: number;
}

export const FILTROS_DEFAULT: Filtros = {
  rango: '90d',
  campoId: 'todos',
  evento: 'todos',
};

export function aplicarFiltros(data: Paricion[], f: Filtros, today = new Date('2026-04-22')): Paricion[] {
  // Si hay año específico seteado, filtramos Jan 1 → Dec 31 de ese año.
  if (f.año != null) {
    const a = String(f.año);
    const desde = `${a}-01-01`;
    const hasta = `${a}-12-31`;
    return data.filter(p => {
      if (p.fecha < desde || p.fecha > hasta) return false;
      if (f.campoId !== 'todos' && p.campoId !== f.campoId) return false;
      if (f.evento !== 'todos' && p.evento !== f.evento) return false;
      return true;
    });
  }

  const desde = new Date(today);
  if (f.rango === '7d') desde.setDate(desde.getDate() - 7);
  else if (f.rango === '30d') desde.setDate(desde.getDate() - 30);
  else if (f.rango === '90d') desde.setDate(desde.getDate() - 90);
  else if (f.rango === '12m') desde.setMonth(desde.getMonth() - 12);
  else desde.setFullYear(2000);

  const desdeISO = desde.toISOString().slice(0, 10);
  return data.filter(p => {
    if (p.fecha < desdeISO) return false;
    if (f.campoId !== 'todos' && p.campoId !== f.campoId) return false;
    if (f.evento !== 'todos' && p.evento !== f.evento) return false;
    return true;
  });
}
