// Tipos compartidos con la app mobile. Cuando pongamos Supabase, estos van
// a ser los tipos generados automáticamente por supabase-gen.
//
// Enums calibrados contra los datos reales del AppSheet (GVA_F(6).xlsx).
//
// IMPORTANTE (schema v0.3): estos enums son los VALORES SUGERIDOS que
// alimentan los autocompletes del UI. Los columnas equivalentes en la DB
// son `text` libre (sin CHECK ni FK), respaldados por la tabla `opciones`.
// El admin puede agregar/editar valores desde el panel sin migraciones.
// Tratá estos types como "defaults útiles", no como contrato estricto.

// ─────────────────────────────────────────────────────────────────────────────
// Tipos COMPARTIDOS — re-exports del canonical (fuente única en
// `types.canonical.ts`). Si necesitás agregar valores a los catálogos,
// editá ese archivo Y corré `npm run sync-types` para propagar a la app.
// ─────────────────────────────────────────────────────────────────────────────
// Import + re-export — el import sirve para usar los tipos en este archivo
// (ej. interface Mortandad que usa CausaMuerteTipo); el re-export sirve
// para que otros componentes los importen desde '@/data/types' como antes.
import type {
  Sexo,
  SiNo,
  CaravanaColor,
  VacasGrupo,
  EventoParicion,
  CausaMuerteTipo,
  ParicionCanonical,
  LluviaCanonical,
  MortandadCanonical,
  PastoreoCanonical,
} from './types.canonical';
export type {
  Sexo,
  SiNo,
  CaravanaColor,
  VacasGrupo,
  EventoParicion,
  CausaMuerteTipo,
};

// Catálogos compartidos — vienen del canonical
export type { CampoCanonical as Campo,
              LoteCanonical as Lote,
              PluviometroCanonical as Pluviometro,
              CircuitoCanonical as Circuito,
              ParcelaCanonical as Parcela } from './types.canonical';

// SyncState es SOLO para el sync flow del app móvil (offline → cloud),
// pero el dashboard también lo lee de los rows ya sincados. Lo dejamos
// específico del web por ahora (el app lo tiene definido aparte).
export type SyncState = 'pending' | 'syncing' | 'synced' | 'failed';

// Campo se re-exporta desde CampoCanonical en el bloque de catálogos arriba.

// Paricion = ParicionCanonical + syncState (este último es específico del
// repo web para reflejar si el row vino sincronizado desde la app móvil).
export interface Paricion extends ParicionCanonical {
  syncState: SyncState;
}

// -----------------------------------------------------------------------------
// Lluvia — del canonical directo (no necesita extensiones específicas del web)
// -----------------------------------------------------------------------------
export type Lluvia = LluviaCanonical;

// -----------------------------------------------------------------------------
// Tactos — para el módulo Preñez
// -----------------------------------------------------------------------------
//
// Un tacto = revisión veterinaria de un grupo (rodeo) para confirmar
// preñez. La data viene del veterinario externo, hoy se carga vía SQL.
// Cuando haya form en app móvil, se va a poder cargar desde allí.
export interface Tacto {
  id: string;
  rodeo: string;
  campo?: string;
  fecha?: string;
  origenTotal: number;
  prenezCabeza: number;
  prenezCuerpo: number;
  prenezCola: number;
  vacias: number;
  perdon: number;
  descarte: number;
  feedLot: number;
}

// -----------------------------------------------------------------------------
// NDVI / Materia Seca
// -----------------------------------------------------------------------------
//
// Cada row es una medición satelital de una parcela en una fecha dada.
// Los datos vienen de imágenes Sentinel/Auravant procesadas que el cliente
// nos pasa como Excel. La conversión NDVI → MS_kg_ha se hace según la
// tabla de referencia del cliente:
//   <0.30        → 2000 (rebrote/estrés)
//   0.30 – 0.40  → 2750 (intermedio)
//   0.40 – 0.60  → 5000 (buen crecimiento)
//   >0.60        → 7500 (alta biomasa)
export interface NdviPastura {
  id: string;
  fecha: string;
  campo: string;        // nombre del campo (texto libre)
  circuito: string;     // nombre del circuito (matchea con circuitos.nombre)
  lote?: string;
  parcelas?: number;    // cuántas parcelas se midieron en este registro
  hectareas?: number;
  ndvi?: number;        // 0-1
  msKgHa?: number;
  msTotalKg?: number;
  estado?: string;      // Bajo / Intermedio / Bueno / Alto
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Mortandad — del canonical + GPS aplanado específico del dashboard.
// El app móvil usa GPS anidado `gps: {lat, lon}` (UX form); acá los
// aplanamos para simplificar charts de mapa (MortandadMap.tsx). El mapper
// rowToMortandad convierte cuando llega del backend.
// -----------------------------------------------------------------------------
export interface Mortandad extends MortandadCanonical {
  gpsLat?: number;
  gpsLon?: number;
  gpsAccuracyM?: number;
}

// -----------------------------------------------------------------------------
// Pastoreo (stay log) — del canonical directo
// -----------------------------------------------------------------------------
export type Pastoreo = PastoreoCanonical;

// -----------------------------------------------------------------------------
// Resumen Mermas Servicio (migration 0020) — agregación anual por tropa
// -----------------------------------------------------------------------------
//
// Tabla DISTINTA a `pariciones` (eventos individuales): este es el resumen
// que arma Agus al cierre de cada temporada, con 1 row por tropa. La
// métrica clave es `ternerosVivos` (en verde en el Excel del cliente —
// es el ÚNICO número que importa para % destete real).
export interface ResumenServicio {
  id: string;
  servicioAnio: number;
  campo: string;
  tropa: string;
  prenadas?: number;
  vaciasRetacto?: number;
  prenadasRetacto?: number;
  nptAbortosRetacto?: number;
  // Vientres muertos DURANTE servicio (no son terneros — corregido vs antes)
  mortandadVientres?: number;
  ternerosSenalados?: number;
  ternerosSinSenalar?: number;
  recuentoSalidaTerneros?: number;
  vacasDuranteServicio?: number;
  ternerosNacidos?: number;
  /** Métrica clave — terneros vivos al destete (verde en el Excel). */
  ternerosVivos?: number;
  // Mermas
  mermaTrParicion?: number;
  mermaTrDestete?: number;
  pctAbortosNpt?: number;
  pctMortVientres?: number;
  pctMortTernSenalados?: number;
  pctMortTernSinSenal?: number;
  pctDesteteSobrePrenado?: number;
  observaciones?: string;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Pastoreo Ciclo (migration 0018) — modelo con 3 etapas: Largada, Control, Final
// -----------------------------------------------------------------------------
//
// 1 row = 1 grupo de animales que recorre un circuito durante una temporada.
// Cada etapa es opcional: típicamente todos tienen Largada, ~30% tienen
// Control intermedio, ~85% tienen Cierre/Final cargado.
//
// El dashboard usa este tipo para los "globitos" (KPIs) del Power BI y
// para filtrar por Campo, Circuito, Categoría y Etapa.
export interface PastoreoCiclo {
  id: string;
  campoId?: string;
  campoNombre: string;
  circuitoNombre: string;
  categoria: string; // novillito / Vaquillas / Vaq 15M / Vaq a 27 Meses

  hasCircuito?: number;
  cantAnimales?: number;
  cargaCaHa?: number;

  // LARGADA
  fechaIngreso?: string;
  pesoPromIngresoSinDesbaste?: number;
  kgNetoIngresoDesbaste?: number;
  kgTotalesCarneIngreso?: number;
  cargaKgCarneHaReal?: number;

  // CONTROL (opcional)
  fechaControl?: string;
  cantControl?: number;
  kgNetoControl?: number;
  kgTotalesCarneControl?: number;
  kgCarneProducidosAnimalControl?: number;
  diasPastoreoControl?: number;
  gdpvControl?: number;
  kgCarneProducidosHaControl?: number;

  // FINAL / Cierre
  fechaEncierre?: string;
  cantFinal?: number;
  kgNetoFinal?: number;
  kgTotalesCarneFinal?: number;
  kgCarneProducidosAnimalFinal?: number;
  diasPastoreoFinal?: number;
  gdpvFinal?: number;
  kgCarneProducidosHaFinal?: number;

  observaciones?: string;
  creadoPorEmail?: string;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Compra (migration 0004)
// -----------------------------------------------------------------------------
//
// Replica el módulo "Compra" del AppSheet del cliente. Captura entrada de
// hacienda (compra) — datos físicos (kg origen/destino), comerciales
// (precio, consignado) y logísticos (DTE, km, número de operación).
//
// El tipo canónico vive en `types.canonical.ts` (compartido con la app).
// En el dashboard NO necesitamos extender — usamos el canónico directo.
export type { CompraCanonical as Compra } from './types.canonical';

// Circuito (+ Campo, Lote, Pluviometro, Parcela) se re-exportan desde el
// canonical en el bloque de catálogos arriba del archivo. Dejamos este
// comentario por si alguien busca "Circuito" con grep.
