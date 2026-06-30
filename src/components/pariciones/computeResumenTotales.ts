// =============================================================================
// computeResumenTotales — agrega rows de pariciones_resumen_servicio en KPIs
// =============================================================================
//
// Función PURA (sin React, sin side effects) que toma las rows del resumen
// del servicio que carga Agus al cierre de temporada y devuelve los totales
// listos para renderizar.
//
// Por qué afuera de ParicionesPage:
//   - Reusable: cualquier otro componente (ej. PDF export futuro) puede usarla.
//   - Testeable (A5): los tests unitarios de Vitest la corren sin DOM.
//   - Aislamiento: la lógica de "qué año tomamos" + "qué porcentajes calcular"
//     vive en un solo lugar — si cambian las fórmulas del Excel, se toca acá.

import type { ResumenServicio } from '@/data/types';

export interface ResumenTotales {
  /** Año del servicio que estamos viendo (el más reciente cargado). */
  anio: number;
  /** Cantidad de tropas con datos en ese año. */
  tropas: number;

  // KPIs absolutos (cuentas)
  prenadas: number;
  vacasDuranteServ: number;       // = Preñadas − Mort. Vientres
  nacidos: number;                // Terneros Nacidos
  vivos: number;                  // Terneros Vivos (la métrica clave)
  mortVientres: number;
  mortTernSenal: number;
  mortTernSinSen: number;
  recuentoSalida: number;
  nptAbortos: number;

  // Mermas (acumuladas)
  mermaTrParicion: number;        // = (Preñadas − Nacidos) / Preñadas
  mermaTrDestete: number;         // = (Preñadas − Vivos)   / Preñadas

  // % de eficiencia — réplica literal del Excel del cliente
  pctAbortosNpt: number;          // = NPT+Abortos / Preñadas
  pctMortVientres: number;        // = Mort.Vientres / Preñadas
  pctMortTernSenal: number;       // = Mort.Señalados / Nacidos
  pctMortTernSinSen: number;      // = Mort.SinSeñalar / Nacidos
  pctDesteteSobrePren: number;    // = Vivos / Preñadas
}

/**
 * Devuelve los totales del año más reciente con datos válidos, o `null` si
 * no hay nada cargado (cliente nuevo que aún no cerró temporada — el caller
 * cae al cálculo legacy desde eventos individuales).
 *
 * @param resumenServicio  Rows del cierre del servicio (puede traer múltiples campos/años)
 * @param campoNombre      Nombre del campo a filtrar, o null/undefined para "todos los campos".
 *                         Si se pasa, solo se agregan las tropas de ese campo
 *                         (caso de uso: filtro de campo en ParicionesPage).
 */
export function computeResumenTotales(
  resumenServicio: ResumenServicio[] | undefined,
  campoNombre?: string | null,
): ResumenTotales | null {
  if (!resumenServicio || resumenServicio.length === 0) return null;

  // Filtro de campo (si se especificó) — replica el comportamiento del
  // KpisLegacy donde `aplicarFiltros()` también lo aplica. Antes este
  // helper ignoraba el filtro y mostraba siempre totales globales — bug
  // reportado por el cliente: "filtro Carolina no actualiza KPIs".
  const filtradosPorCampo = campoNombre
    ? resumenServicio.filter(r => r.campo === campoNombre)
    : resumenServicio;
  if (filtradosPorCampo.length === 0) return null;

  // Año más reciente con datos. El .filter() es defensivo — `servicioAnio`
  // es nullable en DB y Math.max(...[]) devuelve -Infinity.
  const aniosValidos = filtradosPorCampo
    .map(r => r.servicioAnio)
    .filter((x): x is number => Number.isFinite(x));
  if (aniosValidos.length === 0) return null;

  const ultimoAnio = Math.max(...aniosValidos);
  const rows = filtradosPorCampo.filter(r => r.servicioAnio === ultimoAnio);

  const sum = (pick: (r: ResumenServicio) => number | undefined) =>
    rows.reduce<number>((s, r) => s + (pick(r) ?? 0), 0);

  const prenadas         = sum(r => r.prenadas);
  const nptAbortos       = sum(r => r.nptAbortosRetacto);
  const mortVientres     = sum(r => r.mortandadVientres);
  const mortTernSenal    = sum(r => r.ternerosSenalados);
  const mortTernSinSen   = sum(r => r.ternerosSinSenalar);
  const recuentoSalida   = sum(r => r.recuentoSalidaTerneros);
  const vacasDuranteServ = sum(r => r.vacasDuranteServicio);
  const nacidos          = sum(r => r.ternerosNacidos);
  const vivos            = sum(r => r.ternerosVivos);

  // den(d) evita división por cero — UI muestra 0% en lugar de NaN%.
  const den = (d: number) => (d > 0 ? d : 1);

  return {
    anio: ultimoAnio,
    tropas: rows.length,
    prenadas, vacasDuranteServ, nacidos, vivos,
    mortVientres, mortTernSenal, mortTernSinSen, recuentoSalida, nptAbortos,
    mermaTrParicion:     prenadas > 0 ? (prenadas - nacidos) / den(prenadas) : 0,
    mermaTrDestete:      prenadas > 0 ? (prenadas - vivos)   / den(prenadas) : 0,
    pctAbortosNpt:       nptAbortos     / den(prenadas),
    pctMortVientres:     mortVientres   / den(prenadas),
    pctMortTernSenal:    mortTernSenal  / den(nacidos),
    pctMortTernSinSen:   mortTernSinSen / den(nacidos),
    pctDesteteSobrePren: vivos          / den(prenadas),
  };
}
