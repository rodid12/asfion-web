// =============================================================================
// computeKpisLegacy — fórmulas DAX del Power BI original (eventos individuales)
// =============================================================================
//
// Calcula los 14 KPIs LITERALES del Power BI de Agus desde los eventos
// individuales de la tabla `pariciones`. Se usa cuando el cliente todavía
// no cargó el resumen del cierre del servicio — fallback que funciona desde
// el día 1 con la data que el peón va cargando en el campo.
//
// Para clientes que SÍ cargaron el cierre, ParicionesPage usa
// computeResumenTotales en lugar de esta (matchea exacto el Excel).
//
// Función PURA — testeable con Vitest en A5 sin DOM. Las 11 fórmulas DAX
// están comentadas inline.

import type { Campo, Mortandad, Paricion } from '@/data/types';

export interface KpisLegacy {
  // Conteos absolutos
  total: number;              // = "Eventos" del DAX
  eventos: number;            // alias explícito
  nacimientos: number;        // = "Nacimientos Total" del DAX
  nacimientosVivos: number;   // = Nacimientos − Muerte Señalado (aprox)
  muertes: number;
  abortos: number;
  retactos: number;           // = 0 (no se usa más en DAX, dejado para compat UI)
  muerteSenalado: number;
  nacidoMuerto: number;
  vacasParidas: number;
  ternerosMuertosTotales: number;
  vacasMuertas: number;
  ternerosEnPie: number;      // = Nacimientos − Muerte Señalado
  stockBase: number;
  vacasSinParir: number;      // Preñez: Stock − nac. − muertes − vientres − abortos
  orejanos: number;
  asistidos: number;

  // Porcentajes
  pctParicion: number;
  pctDestete: number;
  pctAbortos: number;
  pctMuerteSenal: number;
  pctNacidoMuerto: number;
}

const KPIS_EMPTY: KpisLegacy = {
  total: 0, eventos: 0, nacimientosVivos: 0, nacimientos: 0, muertes: 0,
  abortos: 0, retactos: 0, muerteSenalado: 0, nacidoMuerto: 0,
  vacasParidas: 0, ternerosMuertosTotales: 0, vacasMuertas: 0,
  ternerosEnPie: 0, stockBase: 0, vacasSinParir: 0, orejanos: 0, asistidos: 0,
  pctParicion: 0, pctDestete: 0, pctAbortos: 0, pctMuerteSenal: 0, pctNacidoMuerto: 0,
};

const norm = (s?: string | null) => (s ?? '').trim().toUpperCase();
const normSinAcentos = (s?: string | null) => norm(s)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');
const CATEGORIAS_VIENTRE = new Set([
  'VAQ 1° SERVICIO', 'VAQ 1 SERVICIO',
  'VAQ 2° SERVICIO', 'VAQ 2 SERVICIO',
  'VC PREN',
]);

/**
 * Aplica las fórmulas DAX del Power BI a un set filtrado de pariciones y
 * los campos visibles (para el Stock Base como denominador).
 *
 * Verificadas contra el PBI de Agus (26/06/2026): matchean con diferencia
 * de 1 row sobre 2.547 eventos (un nacimiento con campo vacío que el PBI
 * infiere y nosotros no).
 *
 * Devuelve `KPIS_EMPTY` si no hay datos — el caller renderiza placeholders.
 */
export function computeKpisLegacy(
  pariciones: Paricion[],
  camposVisibles: Campo[],
  usarPrenezComoBase = false,
  mortandad: Mortandad[] = [],
): KpisLegacy {
  // El stock debe verse incluso antes de la primera parición de la campaña.
  // Antes el early-return dejaba todos los KPIs en cero y ocultaba la foto
  // inicial proveniente de Preñez.
  const stockBase = camposVisibles.reduce((s, c) => s + (c.stockInicialVacas ?? 0), 0);
  if (pariciones.length === 0) {
    return { ...KPIS_EMPTY, stockBase, vacasSinParir: stockBase };
  }

  // Sets de IDs por filtro — Set elimina duplicados = DISTINCTCOUNT del DAX.
  const eventosIds      = new Set<string>();
  const muertesIds      = new Set<string>();
  const muerteSenIds    = new Set<string>();
  const nacidoMuertoIds = new Set<string>();
  const nacIds          = new Set<string>();
  const abortosIds      = new Set<string>();
  const orejanosIds     = new Set<string>();
  const asistIds        = new Set<string>();
  const partosIds       = new Set<string>();
  const vacasParidasIds = new Set<string>();

  pariciones.forEach(p => {
    const ev = norm(p.evento);
    const sx = norm(p.sexo);
    const ca = norm(p.causaTipo);

    if (ev === 'NACIMIENTO' || ev === 'NACIDO MUERTO' || sx === 'OREJANO') {
      eventosIds.add(p.id);
    }
    if (ev === 'NACIMIENTO' && sx !== 'OREJANO') nacIds.add(p.id);
    if (ev === 'MUERTE') muertesIds.add(p.id);
    if (ev === 'NACIMIENTO') vacasParidasIds.add(p.id);
    if (ev === 'MUERTE' && ca === 'MUERTE SEÑALADO') muerteSenIds.add(p.id);
    if (ca === 'NACIDO MUERTO') nacidoMuertoIds.add(p.id);
    if (ev === 'ABORTO') abortosIds.add(p.id);
    if (sx === 'OREJANO') orejanosIds.add(p.id);
    if (norm(p.asistencia) === 'SI') asistIds.add(p.id);

    // Para la campaña vinculada a Preñez, una vaca deja de estar "por parir"
    // cuando tuvo nacimiento vivo/orejano, nacido muerto o aborto. Una muerte
    // señalada posterior NO se descuenta de nuevo porque afecta al ternero.
    if (ev !== 'ABORTO' && (
      ev === 'NACIMIENTO' ||
      ev === 'NACIDO MUERTO' ||
      sx === 'OREJANO' ||
      ca === 'NACIDO MUERTO'
    )) {
      partosIds.add(p.id);
    }
  });

  const eventos        = eventosIds.size;
  const nacimientos    = nacIds.size;
  const muertes        = muertesIds.size;
  const muerteSenalado = muerteSenIds.size;
  const nacidoMuerto   = nacidoMuertoIds.size;
  const abortos        = abortosIds.size;
  const orejanos       = orejanosIds.size;
  const asistidos      = asistIds.size;
  const vacasParidas   = vacasParidasIds.size;
  const vacasMuertas   = new Set(
    mortandad
      .filter(m => m.fecha >= '2026-05-19' && CATEGORIAS_VIENTRE.has(normSinAcentos(m.categoria)))
      .map(m => m.id),
  ).size;

  // Ternero en Pie = Nacimientos Total − Muerte Señalado
  const ternerosEnPie = Math.max(0, nacimientos - muerteSenalado);

  // Históricos: conserva la fórmula DAX ya validada contra Power BI.
  // Campaña nueva: Preñez es la foto inicial y aplicamos la fórmula vigente
  // de Ganaderas. Nunca mutamos el tacto; este saldo siempre es derivado.
  const vacasSinParir = usarPrenezComoBase
    ? Math.max(0, stockBase - vacasParidas - muertes - vacasMuertas - abortos)
    : Math.max(0, stockBase - eventos + abortos);

  return {
    total: eventos,
    eventos,
    nacimientosVivos: Math.max(0, nacimientos - muerteSenalado),
    nacimientos,
    muertes,
    abortos,
    retactos: 0,   // legacy, no se usa más en DAX
    muerteSenalado,
    nacidoMuerto,
    vacasParidas,
    ternerosMuertosTotales: muertes,
    vacasMuertas,
    ternerosEnPie,
    stockBase,
    vacasSinParir,
    orejanos,
    asistidos,
    pctParicion:     stockBase   ? nacimientos / stockBase    : 0,
    pctDestete:      stockBase   ? ternerosEnPie / stockBase  : 0,
    pctAbortos:      stockBase   ? abortos / stockBase        : 0,
    pctMuerteSenal:  nacimientos ? muerteSenalado / nacimientos : 0,
    pctNacidoMuerto: nacimientos ? nacidoMuerto / nacimientos : 0,
  };
}
