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

export type VacasGrupo = 'Vacas cabeza' | 'Vaca cuerpo' | 'Vaca cola';

// "Retacto" existe en el lookup del AppSheet pero nunca se usó; lo dejamos
// en el tipo por si en algún momento se empieza a cargar.
export type EventoParicion = 'Nacimiento' | 'Muerte' | 'Aborto' | 'Retacto';

export type Sexo = 'Macho' | 'Hembra' | 'Orejano';
export type SiNo = 'Si' | 'No';

// Solo los colores realmente en uso en los datos reales.
export type CaravanaColor = 'Amarillo' | 'Blanca' | 'Celeste' | 'Naranja';

// Causa de muerte: enum corto en el AppSheet (nivel 1) + texto libre (nivel 2)
export type CausaMuerteTipo = 'Muerte Señalado' | 'Nacido Muerto' | 'Desconocido';

export type SyncState = 'pending' | 'syncing' | 'synced' | 'failed';

export interface Campo {
  id: string;
  nombre: string;
  /**
   * Stock inicial de vacas preñadas al comienzo de temporada. Sirve como
   * denominador de los % de eficiencia (% destete, % abortos, etc).
   * Si está null, los KPIs porcentuales muestran "—".
   */
  stockInicialVacas?: number;
}

export interface Paricion {
  id: string;
  fecha: string;               // YYYY-MM-DD
  campoId: string;
  loteId?: string;
  usuarioEmail: string;
  createdAt: string;
  syncState: SyncState;

  vacasGrupo: VacasGrupo;
  evento: EventoParicion;
  sexo?: Sexo;
  asistencia?: SiNo;
  caravanaColor?: CaravanaColor;
  caravanaNumero?: string;
  causaTipo?: CausaMuerteTipo;    // nivel 1 (enum)
  causaDetalle?: string;          // nivel 2 (texto libre)
  observaciones?: string;
}

// -----------------------------------------------------------------------------
// Lluvia
// -----------------------------------------------------------------------------
export interface Lluvia {
  id: string;
  fecha: string;
  campoId: string;
  usuarioEmail: string;
  pluviometro: string;       // nombre denormalizado (UI legible)
  pluviometroId?: string;
  milimetros: number;
  createdAt: string;
}

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
// Mortandad
// -----------------------------------------------------------------------------
export interface Mortandad {
  id: string;
  fecha: string;
  campoId: string;
  loteId?: string;
  usuarioEmail: string;
  categoria: string;             // catálogo MORT_CATEGORIA (texto libre)
  actividad?: string;
  causaTipo?: CausaMuerteTipo;
  causaDetalle?: string;
  caravanaColor?: CaravanaColor;
  caravanaNumero?: string;
  observaciones?: string;
  // GPS — capturado por el form de la app móvil al registrar la muerte.
  // Útil para mapear dónde están ocurriendo eventos (zonas de pozos,
  // monte cerrado, agua estancada, etc). Opcional porque a veces el
  // operario carga sin señal.
  gpsLat?: number;
  gpsLon?: number;
  gpsAccuracyM?: number;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Pastoreo (stay log — entrada + salida en mismo registro)
// -----------------------------------------------------------------------------
export interface Pastoreo {
  id: string;
  fecha: string;                 // = fecha_entrada
  fechaSalida?: string;          // NULL = stay abierto
  campoId: string;
  circuitoId: string;
  parcelaId: string;
  parcelaNumero?: number;
  usuarioEmail: string;
  categoria: string;             // catálogo PAST_CATEGORIA
  categoriaAnimal?: string;
  evento?: string;
  caravanaNumero?: string;
  causa?: string;
  // Datos productivos (migration 0003) — alimentan los KPIs Animales,
  // KG/Cab, Kg Totales y Carga del dashboard. Opcionales en stays viejos
  // sin estos datos.
  animales?: number;
  kgPromedio?: number;
  createdAt: string;
}

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
export interface Compra {
  id: string;
  fecha: string;
  campoId: string;
  usuarioEmail: string;
  // Físico
  actividad?: string;            // Destete Precoz / Engorde / Invernada
  cantCabYCat?: string;          // "83 machos. 27 hembras"
  // Total machos / hembras como columnas separadas (migration 0017).
  // Antes solo existía cantCabYCat como TEXT, que requería parsing
  // frágil para los KPIs de relación M/H. Si vienen vacíos, el dashboard
  // hace fallback al parseo del texto libre.
  totalMachos?: number;
  totalHembras?: number;
  kgNetosOrigen: number;
  kgNetosDestino: number;
  mermaPorcentaje?: number;      // auto-calculado en form
  kgCorregidos?: number;         // manual
  // Comerciales
  precio?: number;               // ARS/kg típicamente
  consignado?: string;
  titular?: string;
  plazo?: string;
  // Logística
  numeroDte?: string;
  numeroOperacion?: string;
  kmRecorrido?: number;
  observaciones?: string;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Catálogos secundarios — necesarios para resolver nombres en charts
// -----------------------------------------------------------------------------
export interface Circuito {
  id: string;
  campoId: string;
  nombre: string;
  hectareas?: number;
}
