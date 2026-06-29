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
  NdviPastura,
  Paricion,
  Pastoreo,
  PastoreoCiclo,
  ResumenServicio,
  Sexo,
  SiNo,
  Tacto,
  VacasGrupo,
} from './types';

// ----------------------------------------------------------------------------
// Paginación
// ----------------------------------------------------------------------------
//
// Supabase tiene un límite por defecto de 1000 rows por query. Si la tabla
// pasa de eso (pariciones tiene 2500+, mortandad llega a 200+, etc.), el
// dashboard mostraba data truncada — y los KPIs salían a ~40% del valor real.
//
// Esta helper itera con .range() hasta que la página llega vacía o más
// chica que el page size. Devuelve todas las rows en un solo array.
//
// Uso: const data = await fetchAllPaginated('pariciones', q => q.order('fecha', { ascending: false }));

const PAGE_SIZE = 1000;

type QueryBuilder = ReturnType<ReturnType<typeof supabase.from>['select']>;

async function fetchAllPaginated<T = any>(
  table: string,
  applyOrder: (q: QueryBuilder) => QueryBuilder,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  // Q3 audit: antes este loop tenía `while (out.length < 100_000)` como
  // safeguard contra loops infinitos. El problema: si una tabla crecía a
  // 100.001 filas, el último page se cortaba silencioso. Cambio a
  // `while (true)` con break explícito cuando data.length < PAGE_SIZE
  // (= esa fue la última página). Si por alguna razón Supabase devuelve
  // PAGE_SIZE exacto en cada llamada (loop infinito real), explotamos con
  // un error después de 1.000 iteraciones — eso son 1M de filas, MUY
  // arriba de cualquier caso real de un cliente.
  let iter = 0;
  while (true) {
    if (iter++ > 1000) throw new Error(`fetchAllPaginated(${table}): >1M filas, abortando`);
    const base = supabase.from(table).select('*');
    const ordered = applyOrder(base);
    const { data, error } = await ordered.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

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
  try {
    const rows = await fetchAllPaginated<any>('pariciones',
      q => q.order('fecha', { ascending: false }) as QueryBuilder);
    return rows.map(rowToParicion);
  } catch (err: any) {
    throw new Error(`fetchPariciones: ${err?.message ?? err}`);
  }
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
  try {
    const rows = await fetchAllPaginated<any>('lluvias',
      q => q.order('fecha', { ascending: false }) as QueryBuilder);
    return rows.map(rowToLluvia);
  } catch (err: any) {
    throw new Error(`fetchLluvias: ${err?.message ?? err}`);
  }
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
  try {
    const rows = await fetchAllPaginated<any>('mortandad',
      q => q.order('fecha', { ascending: false }) as QueryBuilder);
    return rows.map(rowToMortandad);
  } catch (err: any) {
    throw new Error(`fetchMortandad: ${err?.message ?? err}`);
  }
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
  try {
    const rows = await fetchAllPaginated<any>('pastoreo',
      q => q.order('fecha_entrada', { ascending: false }) as QueryBuilder);
    return rows.map(rowToPastoreo);
  } catch (err: any) {
    throw new Error(`fetchPastoreo: ${err?.message ?? err}`);
  }
}

// =============================================================================
// Pastoreo Ciclos (migration 0018) — Largada / Control / Final
// =============================================================================

function num(v: any): number | undefined {
  return v != null ? Number(v) : undefined;
}

function rowToPastoreoCiclo(r: any): PastoreoCiclo {
  return {
    id: r.id,
    campoId: r.campo_id ?? undefined,
    campoNombre: r.campo_nombre,
    circuitoNombre: r.circuito_nombre,
    categoria: r.categoria,
    hasCircuito:                       num(r.has_circuito),
    cantAnimales:                      num(r.cant_animales),
    cargaCaHa:                         num(r.carga_ca_ha),
    // Largada
    fechaIngreso:                      r.fecha_ingreso ?? undefined,
    pesoPromIngresoSinDesbaste:        num(r.peso_prom_ingreso_sin_desbaste),
    kgNetoIngresoDesbaste:             num(r.kg_neto_ingreso_desbaste),
    kgTotalesCarneIngreso:             num(r.kg_totales_carne_ingreso),
    cargaKgCarneHaReal:                num(r.carga_kg_carne_ha_real),
    // Control
    fechaControl:                      r.fecha_control ?? undefined,
    cantControl:                       num(r.cant_control),
    kgNetoControl:                     num(r.kg_neto_control),
    kgTotalesCarneControl:             num(r.kg_totales_carne_control),
    kgCarneProducidosAnimalControl:    num(r.kg_carne_producidos_animal_control),
    diasPastoreoControl:               num(r.dias_pastoreo_control),
    gdpvControl:                       num(r.gdpv_control),
    kgCarneProducidosHaControl:        num(r.kg_carne_producidos_ha_control),
    // Final
    fechaEncierre:                     r.fecha_encierre ?? undefined,
    cantFinal:                         num(r.cant_final),
    kgNetoFinal:                       num(r.kg_neto_final),
    kgTotalesCarneFinal:               num(r.kg_totales_carne_final),
    kgCarneProducidosAnimalFinal:      num(r.kg_carne_producidos_animal_final),
    diasPastoreoFinal:                 num(r.dias_pastoreo_final),
    gdpvFinal:                         num(r.gdpv_final),
    kgCarneProducidosHaFinal:          num(r.kg_carne_producidos_ha_final),
    observaciones:                     r.observaciones ?? undefined,
    creadoPorEmail:                    r.creado_por_email ?? undefined,
    createdAt:                         r.created_at,
  };
}

// =============================================================================
// Resumen Mermas Servicio (migration 0020)
// =============================================================================

function rowToResumenServicio(r: any): ResumenServicio {
  return {
    id: r.id,
    servicioAnio: r.servicio_anio,
    campo: r.campo,
    tropa: r.tropa,
    prenadas:                num(r.prenadas),
    vaciasRetacto:           num(r.vacias_retacto),
    prenadasRetacto:         num(r.prenadas_retacto),
    nptAbortosRetacto:       num(r.npt_abortos_retacto),
    mortandadVientres:       num(r.mortandad_vientres),
    ternerosSenalados:       num(r.terneros_senalados),
    ternerosSinSenalar:      num(r.terneros_sin_senalar),
    recuentoSalidaTerneros:  num(r.recuento_salida_terneros),
    vacasDuranteServicio:    num(r.vacas_durante_servicio),
    ternerosNacidos:         num(r.terneros_nacidos),
    ternerosVivos:           num(r.terneros_vivos),
    mermaTrParicion:         num(r.merma_tr_paricion),
    mermaTrDestete:          num(r.merma_tr_destete),
    pctAbortosNpt:           num(r.pct_abortos_npt),
    pctMortVientres:         num(r.pct_mort_vientres),
    pctMortTernSenalados:    num(r.pct_mort_tern_senalados),
    pctMortTernSinSenal:     num(r.pct_mort_tern_sin_senal),
    pctDesteteSobrePrenado:  num(r.pct_destete_sobre_prenado),
    observaciones:           r.observaciones ?? undefined,
    createdAt:               r.created_at,
  };
}

export async function fetchResumenServicio(): Promise<ResumenServicio[]> {
  try {
    const rows = await fetchAllPaginated<any>('pariciones_resumen_servicio',
      q => q.order('servicio_anio', { ascending: false }) as QueryBuilder);
    return rows.map(rowToResumenServicio);
  } catch (err: any) {
    if (/relation "pariciones_resumen_servicio" does not exist/i.test(err?.message ?? '')) {
      console.warn('fetchResumenServicio: tabla aún no creada — corré migration 0020');
      return [];
    }
    throw new Error(`fetchResumenServicio: ${err?.message ?? err}`);
  }
}

export async function fetchPastoreoCiclos(): Promise<PastoreoCiclo[]> {
  try {
    const rows = await fetchAllPaginated<any>('pastoreo_ciclos',
      q => q.order('fecha_ingreso', { ascending: false }) as QueryBuilder);
    return rows.map(rowToPastoreoCiclo);
  } catch (err: any) {
    // Fallback graceful si la tabla todavía no existe en la DB del cliente
    // (migración 0018 no aplicada): devolvemos array vacío para que el
    // dashboard renderee el EmptyModule en lugar de explotar.
    if (/relation "pastoreo_ciclos" does not exist/i.test(err?.message ?? '')) {
      console.warn('fetchPastoreoCiclos: tabla pastoreo_ciclos aún no creada — corré migration 0018');
      return [];
    }
    throw new Error(`fetchPastoreoCiclos: ${err?.message ?? err}`);
  }
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
    totalMachos:     r.total_machos  != null ? Number(r.total_machos)  : undefined,
    totalHembras:    r.total_hembras != null ? Number(r.total_hembras) : undefined,
    kgNetosOrigen:   Number(r.kg_netos_origen),
    kgNetosDestino:  r.kg_netos_destino != null ? Number(r.kg_netos_destino) : null,
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
  try {
    const rows = await fetchAllPaginated<any>('compras',
      q => q.order('fecha', { ascending: false }) as QueryBuilder);
    return rows.map(rowToCompra);
  } catch (err: any) {
    throw new Error(`fetchCompras: ${err?.message ?? err}`);
  }
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
  // select() explícito (Q1 audit) — antes select('*') traía columnas que no
  // usamos (created_at, updated_at, etc). Ahorra ~30% bytes en transit.
  const { data, error } = await supabase
    .from('circuitos')
    .select('id, campo_id, nombre, hectareas')
    .order('nombre');
  if (error) throw new Error(`fetchCircuitos: ${error.message}`);
  return (data ?? []).map(rowToCircuito);
}

// =============================================================================
// NDVI / Materia Seca (migration 0009)
// =============================================================================

function rowToNdvi(r: any): NdviPastura {
  return {
    id: r.id,
    fecha: r.fecha,
    campo: r.campo,
    circuito: r.circuito,
    lote: r.lote ?? undefined,
    parcelas:   r.parcelas    != null ? Number(r.parcelas)    : undefined,
    hectareas:  r.hectareas   != null ? Number(r.hectareas)   : undefined,
    ndvi:       r.ndvi        != null ? Number(r.ndvi)        : undefined,
    msKgHa:     r.ms_kg_ha    != null ? Number(r.ms_kg_ha)    : undefined,
    msTotalKg:  r.ms_total_kg != null ? Number(r.ms_total_kg) : undefined,
    estado:     r.estado ?? undefined,
    createdAt:  r.created_at,
  };
}

// =============================================================================
// Tactos (Preñez) — migration 0012
// =============================================================================

function rowToTacto(r: any): Tacto {
  return {
    id: r.id,
    rodeo: r.rodeo,
    campo: r.campo ?? undefined,
    fecha: r.fecha ?? undefined,
    origenTotal:    Number(r.origen_total ?? 0),
    prenezCabeza:   Number(r.prenez_cabeza ?? 0),
    prenezCuerpo:   Number(r.prenez_cuerpo ?? 0),
    prenezCola:     Number(r.prenez_cola ?? 0),
    vacias:         Number(r.vacias ?? 0),
    perdon:         Number(r.perdon ?? 0),
    descarte:       Number(r.descarte ?? 0),
    feedLot:        Number(r.feed_lot ?? 0),
  };
}

export async function fetchTactos(): Promise<Tacto[]> {
  try {
    const rows = await fetchAllPaginated<any>('tactos',
      q => q.order('rodeo', { ascending: true }) as QueryBuilder);
    return rows.map(rowToTacto);
  } catch (err: any) {
    // La tabla se crea en migration 0012. Si todavía no aplicó, devolvemos
    // array vacío para que el módulo Preñez muestre su empty state sin
    // romper el dashboard.
    const msg = String(err?.message ?? err).toLowerCase();
    if (msg.includes('does not exist') || msg.includes('relation') || err?.code === '42P01') {
      console.warn('Tabla tactos no existe todavía — aplicá migration 0012');
      return [];
    }
    throw new Error(`fetchTactos: ${err?.message ?? err}`);
  }
}

export async function fetchNdvi(): Promise<NdviPastura[]> {
  try {
    const rows = await fetchAllPaginated<any>('ndvi_pasturas',
      q => q.order('fecha', { ascending: false }) as QueryBuilder);
    return rows.map(rowToNdvi);
  } catch (err: any) {
    // La tabla recién se crea en migration 0009. Si todavía no aplicó,
    // devolvemos array vacío para que el módulo siga funcionando con
    // su empty state en vez de tirar error global.
    const msg = String(err?.message ?? err).toLowerCase();
    if (msg.includes('does not exist') || msg.includes('relation') || err?.code === '42P01') {
      console.warn('Tabla ndvi_pasturas no existe todavía — aplicá migration 0009');
      return [];
    }
    throw new Error(`fetchNdvi: ${err?.message ?? err}`);
  }
}
