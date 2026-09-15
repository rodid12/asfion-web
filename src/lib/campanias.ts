import type { CampaniaOperativa, CampaniaReproductiva } from '@/data/types';

export function fechaHoyISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fallback mientras migration 0036 todavía no fue aplicada. */
export function campaniasOperativasFallback(hoy = new Date()): CampaniaOperativa[] {
  const inicio = hoy.getMonth() + 1 >= 9 ? hoy.getFullYear() : hoy.getFullYear() - 1;
  const make = (anio: number, activa: boolean): CampaniaOperativa => ({
    id: `campania-operativa-fallback-${anio}-${anio + 1}`,
    nombre: `Campaña ${anio}/${String(anio + 1).slice(2)}`,
    fechaInicio: `${anio}-09-01`,
    fechaFin: `${anio + 1}-08-31`,
    activa,
  });
  return [make(inicio, true), make(inicio - 1, false)];
}

export function elegirCampaniaActual(campanias: CampaniaOperativa[]): CampaniaOperativa | undefined {
  const hoy = fechaHoyISO();
  return campanias.find(c => hoy >= c.fechaInicio && hoy <= c.fechaFin)
    ?? campanias.find(c => c.activa)
    ?? [...campanias].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))[0];
}

/** Garantiza cambio automático de campaña cada 1 de septiembre. */
export function asegurarCampaniaDeHoy(
  configuradas: CampaniaOperativa[],
  fallback: CampaniaOperativa[],
): CampaniaOperativa[] {
  const hoy = fechaHoyISO();
  const encontrada = configuradas.find(c => hoy >= c.fechaInicio && hoy <= c.fechaFin);
  if (encontrada) return configuradas.map(c => ({ ...c, activa: c.id === encontrada.id }));
  const actualFallback = elegirCampaniaActual(fallback)!;
  return [actualFallback, ...configuradas.map(c => ({ ...c, activa: false }))];
}

/**
 * Completa el selector con campañas históricas detectadas en los eventos.
 * La DB administra la campaña actual; las sintéticas solo garantizan que un
 * año viejo nunca quede inaccesible por no tener un row de catálogo.
 */
export function completarCampaniasDesdeFechas(
  configuradas: CampaniaOperativa[],
  fechas: Array<string | undefined>,
): CampaniaOperativa[] {
  const out = [...configuradas];
  const yaCubierta = (fecha: string) => out.some(c => fecha >= c.fechaInicio && fecha <= c.fechaFin);
  for (const fecha of fechas) {
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || yaCubierta(fecha)) continue;
    const anio = Number(fecha.slice(0, 4));
    const mes = Number(fecha.slice(5, 7));
    if (!Number.isFinite(anio) || !Number.isFinite(mes)) continue;
    const inicio = mes >= 9 ? anio : anio - 1;
    out.push({
      id: `campania-operativa-historica-${inicio}-${inicio + 1}`,
      nombre: `Campaña ${inicio}/${String(inicio + 1).slice(2)}`,
      fechaInicio: `${inicio}-09-01`,
      fechaFin: `${inicio + 1}-08-31`,
      activa: false,
    });
  }
  return out.sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
}

export function finReproductivo(campania: CampaniaOperativa): string {
  const anioInicio = Number(campania.fechaInicio.slice(0, 4));
  const marzo = `${anioInicio + 1}-03-31`;
  return marzo < campania.fechaFin ? marzo : campania.fechaFin;
}

export function enCampania(fecha: string | undefined, campania: CampaniaOperativa): boolean {
  return Boolean(fecha && fecha >= campania.fechaInicio && fecha <= campania.fechaFin);
}

export function solapaCampania(
  desde: string | undefined,
  hasta: string | undefined,
  campania: CampaniaOperativa,
): boolean {
  if (!desde && !hasta) return false;
  const inicio = desde ?? hasta!;
  const fin = hasta ?? desde!;
  return inicio <= campania.fechaFin && fin >= campania.fechaInicio;
}

/**
 * Busca la campaña reproductiva correspondiente. Si todavía no existe un row
 * histórico, crea una definición visual Sep–Mar para que Pariciones mantenga
 * el mismo período al cambiar la campaña global.
 */
export function reproductivaParaOperativa(
  operativa: CampaniaOperativa,
  disponibles: CampaniaReproductiva[],
): CampaniaReproductiva {
  const servicioAnio = Number(operativa.fechaInicio.slice(0, 4));
  const existente = disponibles.find(c => c.servicioAnio === servicioAnio)
    ?? disponibles.find(c => c.fechaInicio >= operativa.fechaInicio && c.fechaInicio <= operativa.fechaFin);
  if (existente) return { ...existente, activa: true };
  return {
    id: `campania-reproductiva-visual-${operativa.id}`,
    nombre: `${operativa.nombre} · Pariciones`,
    servicioAnio,
    fechaInicio: operativa.fechaInicio,
    fechaFin: finReproductivo(operativa),
    activa: true,
  };
}
