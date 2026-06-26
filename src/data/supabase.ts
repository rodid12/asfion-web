// Fetchers de Supabase para el dashboard.
//
// El dashboard solo LEE — no escribe nada. Por eso este módulo es chico:
// solo selects con orden y limit. RLS de Supabase se encarga de filtrar
// por cliente_id automáticamente (basado en el JWT del usuario logueado).
//
// Los mappers convierten snake_case del DB al camelCase de los tipos UI,
// que son los mismos que usaba el mock data — así el resto del dashboard
// (charts, tabla, kpis) NO requiere ningún cambio.

import { supabase } from '@/lib/supabase';
import type {
  Campo,
  CaravanaColor,
  CausaMuerteTipo,
  Circuito,
  Compra,
  EventoParicion,
  Lluvia,
  Mortandad,
  Paricion,
  Pastoreo,
  Sexo,
  SiNo,
  VacasGrupo,
} from './types';

function rowToCampo(r: any): Campo {
  return {
    id: r.id,
    nombre: r.nombre,
    stockInicialVacas: r.stock_inicial_vacas != null ? Number(r.stock_inicial_vacas) : undefined,
  };
}

function rowToParicion(r: any): Paricion {
  return {
    id: r.id,
    fecha: r.fecha,
    campoId: r.campo_id,
    loteId: r.lote_id ?? undefined,
    usuarioEmail: r.usuario_email,
    createdAt: r.created_at,
    syncState: 'synced',
    vacasGrupo: r.vacas_grupo as VacasGrupo,
    evento: r.evento as EventoParicion,
    sexo: (r.sexo ?? undefined) as Sexo | undefined,
    asistencia: (r.asistencia ?? undefined) as SiNo | undefined,
    caravanaColor: (r.caravana_color ?? undefined) as CaravanaColor | undefined,
    caravanaNumero: r.caravana_numero ?? undefined,
    causaTipo: (r.causa_tipo ?? undefined) as CausaMuerteTipo | undefined,
    causaDetalle: r.causa_detalle ?? undefined,
    observaciones: r.observaciones ?? undefined,
  };
}

export async function fetchCampos(): Promise<Campo[]> {
  const { data, error } = await supabase
    .from('campos')
    .select('id, nombre, stock_inicial_vacas')
    .order('nombre');
  if (error) throw new Error(`fetchCampos: ${error.message}`);
  return (data ?? []).map(rowToCampo);
}

/**
 * Trae TODAS las pariciones visibles al usuario logueado (RLS las filtra
 * por cliente_id). Sin paginación todavía — la app real tiene ~3.5k filas
 * en 8 meses, perfectamente cargable de una. Si crece a 20k+, agregamos
 * paginación o un view materializado con agregados.
 */
export async function fetchPariciones(): Promise<Paricion[]> {
  const { data, error } = await supabase
    .from('pariciones')
    .select('*')
    .order('fecha', { ascending: false });
  if (error) throw new Error(`fetchPariciones: ${error.message}`);
  return (data ?? []).map(rowToParicion);
}

// =============================================================================
// Lluvias
// =============================================================================

function rowToLluvia(r: any): Lluvia {
  return {
    id: r.id,
    fecha: r.fecha,
    campoId: r.campo_id,
    usuarioEmail: r.usuario_email,
    pluviometro: r.pluviometro_nombre ?? '',
    pluviometroId: r.pluviometro_id ?? undefined,
    milimetros: Number(r.milimetros ?? 0),
    createdAt: r.created_at,
  };
}

export async function fetchLluvias(): Promise<Lluvia[]> {
  const { data, error } = await supabase
    .from('lluvias')
    .select('*')
    .order('fecha', { ascending: false });
  if (error) throw new Error(`fetchLluvias: ${error.message}`);
  return (data ?? []).map(rowToLluvia);
}

// =============================================================================
// Mortandad
// =============================================================================

function rowToMortandad(r: any): Mortandad {
  return {
    id: r.id,
    fecha: r.fecha,
    campoId: r.campo_id,
    loteId: r.lote_id ?? undefined,
    usuarioEmail: r.usuario_email,
    categoria: r.categoria,
    actividad: r.actividad ?? undefined,
    causaTipo: (r.causa_tipo ?? undefined) as CausaMuerteTipo | undefined,
    causaDetalle: r.causa_detalle ?? undefined,
    caravanaColor: (r.caravana_color ?? undefined) as CaravanaColor | undefined,
    caravanaNumero: r.caravana_numero ?? undefined,
    observaciones: r.observaciones ?? undefined,
    gpsLat: r.gps_lat != null ? Number(r.gps_lat) : undefined,
    gpsLon: r.gps_lon != null ? Number(r.gps_lon) : undefined,
    gpsAccuracyM: r.gps_accuracy_m != null ? Number(r.gps_accuracy_m) : undefined,
    createdAt: r.created_at,
  };
}

export async function fetchMortandad(): Promise<Mortandad[]> {
  const { data, error } = await supabase
    .from('mortandad')
    .select('*')
    .order('fecha', { ascending: false });
  if (error) throw new Error(`fetchMortandad: ${error.message}`);
  return (data ?? []).map(rowToMortandad);
}

// =============================================================================
// Pastoreo (stay log)
// =============================================================================

function rowToPastoreo(r: any): Pastoreo {
  return {
    id: r.id,
    fecha: r.fecha_entrada,
    fechaSalida: r.fecha_salida ?? undefined,
    campoId: r.campo_id,
    circuitoId: r.circuito_id,
    parcelaId: r.parcela_id,
    parcelaNumero: r.parcela_numero ?? undefined,
    usuarioEmail: r.usuario_email,
    categoria: r.categoria,
    categoriaAnimal: r.categoria_animal ?? undefined,
    evento: r.evento ?? undefined,
    caravanaNumero: r.caravana_numero ?? undefined,
    causa: r.causa ?? undefined,
    animales:   r.animales    != null ? Number(r.animales)    : undefined,
    kgPromedio: r.kg_promedio != null ? Number(r.kg_promedio) : undefined,
    createdAt: r.created_at,
  };
}

export async function fetchPastoreo(): Promise<Pastoreo[]> {
  const { data, error } = await supabase
    .from('pastoreo')
    .select('*')
    .order('fecha_entrada', { ascending: false });
  if (error) throw new Error(`fetchPastoreo: ${error.message}`);
  return (data ?? []).map(rowToPastoreo);
}

// =============================================================================
// Compras (migration 0004)
// =============================================================================

function rowToCompra(r: any): Compra {
  return {
    id: r.id,
    fecha: r.fecha,
    campoId: r.campo_id,
    usuarioEmail: r.usuario_email,
    actividad:       r.actividad ?? undefined,
    cantCabYCat:     r.cant_cab_y_cat ?? undefined,
    kgNetosOrigen:   Number(r.kg_netos_origen),
    kgNetosDestino:  Number(r.kg_netos_destino),
    mermaPorcentaje: r.merma_porcentaje != null ? Number(r.merma_porcentaje) : undefined,
    kgCorregidos:    r.kg_corregidos    != null ? Number(r.kg_corregidos) : undefined,
    precio:          r.precio != null ? Number(r.precio) : undefined,
    consignado:      r.consignado ?? undefined,
    titular:         r.titular ?? undefined,
    plazo:           r.plazo ?? undefined,
    numeroDte:       r.numero_dte ?? undefined,
    numeroOperacion: r.numero_operacion ?? undefined,
    kmRecorrido:     r.km_recorrido != null ? Number(r.km_recorrido) : undefined,
    observaciones:   r.observaciones ?? undefined,
    createdAt: r.created_at,
  };
}

export async function fetchCompras(): Promise<Compra[]> {
  const { data, error } = await supabase
    .from('compras')
    .select('*')
    .order('fecha', { ascending: false });
  if (error) throw new Error(`fetchCompras: ${error.message}`);
  return (data ?? []).map(rowToCompra);
}

// =============================================================================
// Circuitos (catálogo — necesario para resolver nombres en charts de pastoreo)
// =============================================================================

function rowToCircuito(r: any): Circuito {
  return {
    id: r.id,
    campoId: r.campo_id,
    nombre: r.nombre,
    hectareas: r.hectareas != null ? Number(r.hectareas) : undefined,
  };
}

export async function fetchCircuitos(): Promise<Circuito[]> {
  const { data, error } = await supabase
    .from('circuitos')
    .select('*')
    .order('nombre');
  if (error) throw new Error(`fetchCircuitos: ${error.message}`);
  return (data ?? []).map(rowToCircuito);
}
