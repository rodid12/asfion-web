// Paleta brand para charts del dashboard. Si necesitás un hex en un chart,
// importalo desde acá en lugar de hardcodearlo: así si cambia el brand
// (o el cliente pide otra paleta) cambia un solo lugar.
//
// Filosofía:
//   - Brand primarios (orange / navy) son los protagonistas.
//   - Peach (orangeSoft) para categorías neutras u observaciones.
//   - Status (terracota / danger) para advertencias y eventos negativos.
//   - blueSoft / amber para categorías terciarias cuando hace falta más
//     diferenciación visual sin caer en colores fríos puros (azules
//     saturados rompían la calidez de la paleta brand).

export const CHART_BRAND = {
  // Brand core
  orange:     '#FF8409',   // dominante / acción / positivo
  orangeSoft: '#FFCB95',   // peach (neutral suave)
  orangeTile: '#FFB97A',   // peach un punto más vivido
  navy:       '#163349',
  navyDeep:   '#0F2535',

  // Status
  success:    '#3FAE5A',
  amber:      '#D89425',
  terracota:  '#C9823F',
  danger:     '#C9423F',

  // Accents — categóricos terciarios, suaves para no romper la calidez brand
  blueSoft:   '#6B9DBE',   // azul medio templado (no celeste frío)

  // Neutrales
  textMuted:  '#6B7280',
  border:     '#E5E2DD',
} as const;

/**
 * Mapeo SEMÁNTICO para los 4 eventos de Pariciones. Usado por todos los
 * charts que segmentan por evento (donut, mensuales, por campo, por grupo).
 *
 *   Nacimiento → orange (dominante, positivo)
 *   Retacto    → peach  (neutral, observación)
 *   Muerte     → terracota (warning)
 *   Aborto     → danger (negativo fuerte)
 */
export const EVENTO_COLOR = {
  Nacimiento: CHART_BRAND.orange,
  Retacto:    CHART_BRAND.orangeSoft,
  Muerte:     CHART_BRAND.terracota,
  Aborto:     CHART_BRAND.danger,
} as const;

/**
 * Paleta categórica genérica para charts con N categorías sin mapeo fijo.
 * Empieza con los brand dominantes y va escalando hacia accents.
 */
export const CHART_PALETTE = [
  CHART_BRAND.orange,
  CHART_BRAND.navy,
  CHART_BRAND.orangeSoft,
  CHART_BRAND.terracota,
  CHART_BRAND.blueSoft,
  CHART_BRAND.amber,
  CHART_BRAND.navyDeep,
  CHART_BRAND.success,
] as const;
