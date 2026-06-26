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
