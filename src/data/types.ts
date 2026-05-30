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
