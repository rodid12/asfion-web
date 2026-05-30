// Filtros compartidos entre todos los charts. El Dashboard es el dueño del
// estado; cada chart lee la data YA filtrada que le pasan por props.

import type { EventoParicion, Paricion } from './types';

export type RangoFecha = '7d' | '30d' | '90d' | '12m' | 'todo';

export interface Filtros {
  rango: RangoFecha;
  campoId: string | 'todos';
  evento: EventoParicion | 'todos';
}

export const FILTROS_DEFAULT: Filtros = {
  rango: '90d',
  campoId: 'todos',
  evento: 'todos',
};

export function aplicarFiltros(data: Paricion[], f: Filtros, today = new Date('2026-04-22')): Paricion[] {
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
