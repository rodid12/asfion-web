// =============================================================================
// types.canonical.ts — Tipos COMPARTIDOS entre asfion-app y asfion-web
// =============================================================================
//
// ⚠️ ESTE ARCHIVO ES LA FUENTE DE VERDAD. Está duplicado en:
//   - asfion-web/src/data/types.canonical.ts    ← SE EDITA ACÁ
//   - asfion-app/src/data/types.canonical.ts    ← copia automática
//
// Para mantener los 2 archivos sincronizados:
//   1. Editás ESTE archivo (web)
//   2. Corrés desde el repo web: `npm run sync-types`
//   3. El script copia este archivo al app
//   4. Commiteás ambos repos
//
// REGLA: nunca editar el del app a mano. Si abrís el archivo del app vas
// a ver un header BIG WARNING que dice "no editar".
//
// QUÉ VA EN ESTE ARCHIVO:
//   - Tipos que representan rows de DB (snake_case → camelCase)
//   - Enums / unions de catálogos compartidos
//   - Cualquier interface o type alias que ambos repos lean
//
// QUÉ NO VA EN ESTE ARCHIVO:
//   - Tipos específicos del app móvil (EventoBase, syncState, fotos locales)
//   - Tipos específicos del dashboard (data agregada para charts)
//   - Helpers / factories — esos viven en cada repo
//
// Cada repo tiene su `types.ts` que re-exporta de acá y agrega lo suyo.

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGOS COMPARTIDOS (enums / unions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipo de causa de muerte para Pariciones — coincide con `causa_tipo` en DB.
 * "Desconocido" es el fallback cuando el operario no la registra.
 */
export type CausaMuerteTipo = 'Muerte Señalado' | 'Nacido Muerto' | 'Desconocido';

/**
 * Sexo del ternero — coincide con `sexo` en DB.
 * "Orejano" identifica terneros sin marca (los excluimos de KPIs DAX).
 */
export type Sexo = 'Macho' | 'Hembra' | 'Orejano';

/**
 * Tipos de evento que se cargan desde el form de Pariciones.
 * NOTA: "Nacido Muerto" no aparece como EVENTO en práctica — viene como
 * CAUSA dentro de un evento NACIMIENTO. Lo dejamos por compat con datos
 * históricos que sí lo tenían.
 */
export type EventoParicion = 'Nacimiento' | 'Muerte' | 'Aborto' | 'Retacto';

/**
 * Momento del servicio al que pertenece la vaca (segmentación reproductiva).
 * Coincide con `vacas_grupo` en DB.
 */
export type VacasGrupo = 'Vacas cabeza' | 'Vaca cuerpo' | 'Vaca cola';

/**
 * Sí/No literal — el operario carga así desde catálogos cerrados, NO booleans.
 */
export type SiNo = 'Si' | 'No';

/**
 * Colores reales de caravanas usados en datos históricos del cliente.
 */
export type CaravanaColor = 'Amarillo' | 'Blanca' | 'Celeste' | 'Naranja';

// ─────────────────────────────────────────────────────────────────────────────
// PARICIÓN (mig 0001 + 0010)
// ─────────────────────────────────────────────────────────────────────────────
//
// Cada parición es UN evento sobre UNA vaca/ternero. El operario carga:
//   - dónde (campo, lote opcional)
//   - cuándo (fecha)
//   - qué grupo de servicio (vacas cabeza/cuerpo/cola)
//   - tipo de evento (nacimiento, muerte, aborto, retacto)
//   - identificación animal (sexo, caravana color+número)
//   - asistencia al parto (Si/No)
//   - si fue muerte/aborto: causa (tipo + detalle libre)
//
// Las fórmulas DAX del Power BI del cliente usan DISTINCTCOUNT(ID) — por eso
// cada row es 1 evento, y la unicidad es por `id`.

export interface ParicionCanonical {
  id: string;
  cliente_id?: string;
  fecha: string;                          // 'YYYY-MM-DD'
  campoId: string;
  loteId?: string;
  usuarioEmail: string;

  vacasGrupo: VacasGrupo;
  evento: EventoParicion;
  sexo?: Sexo;                            // no aplica a Aborto
  asistencia?: SiNo;
  caravanaColor?: CaravanaColor;
  caravanaNumero?: string;                // string porque histórico mezcla formatos
  causaTipo?: CausaMuerteTipo;            // nivel 1 — solo si evento=Muerte|Aborto
  causaDetalle?: string;                  // nivel 2 — texto libre
  observaciones?: string;

  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPRA (mig 0004 + 0017 + 0019 + 0021)
// ─────────────────────────────────────────────────────────────────────────────
//
// Refleja el módulo "Compra" del AppSheet del cliente. Estructura:
//   - Identificación (campo, fecha, número de operación)
//   - Físico (cant cabezas, kg origen/destino, merma)
//   - Comercial (precio, consignado, titular, plazo)
//   - Logística (km, DTE, observaciones)
//
// Tipos especiales en este modelo:
//   - kgNetosDestino es number | null porque la mig 0021 permite compras
//     "en tránsito" sin pesaje destino (caso real: operación 0013-26
//     partida en 2 jaulas, ambas sin pesaje al cierre).
//   - merma y kgCorregidos también son nullable y deben ser null si el
//     destino lo es (la mig 0024 CHECK garantiza la coherencia).

export interface CompraCanonical {
  id: string;
  cliente_id?: string;                    // RLS / migrations lo agregan; UI no lo expone
  fecha: string;                          // 'YYYY-MM-DD'
  campoId: string;
  usuarioEmail: string;

  // Físico
  actividad?: string;                     // 'Recepción' | 'Destete Precoz' | 'Engorde' | 'Invernada'
  cantCabYCat?: string;                   // texto libre "83 machos · 27 hembras"
  totalMachos?: number;                   // mig 0017 — columna separada
  totalHembras?: number;                  // mig 0017
  kgNetosOrigen: number;
  kgNetosDestino: number | null;          // mig 0021 NULLABLE (compras en tránsito)
  mermaPorcentaje?: number | null;        // null si destino es null (mig 0024 CHECK)
  kgCorregidos?: number | null;           // idem

  // Comerciales
  precio?: number;                        // ARS/kg
  consignado?: string;
  titular?: string;
  plazo?: string;                         // 'Contado' | '30 días' | '60 días' | '90 días'

  // Logística
  numeroDte?: string;
  numeroOperacion?: string;
  kmRecorrido?: number;
  observaciones?: string;

  createdAt: string;
}

// =============================================================================
// CHANGELOG — anotar cada vez que se modifica este archivo
// =============================================================================
//
// 2026-06-29  — Creación inicial. CompraCanonical migrada desde duplicación
//               en types.ts de cada repo. Aprovecha el null de kgNetosDestino
//               del hotfix de la mañana.
// =============================================================================
