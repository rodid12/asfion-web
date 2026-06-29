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
  Circuito,
  Compra,
  Lluvia,
  Mortandad,
  NdviPastura,
  Paricion,
  Pastoreo,
  PastoreoCiclo,
  ResumenServicio,
  Tacto,
} from './types';
import {
  mapRow,
  CAMPO_SCHEMA,
  PARICION_SCHEMA,
  LLUVIA_SCHEMA,
  MORTANDAD_SCHEMA,
  PASTOREO_SCHEMA,
  COMPRA_SCHEMA,
  CIRCUITO_SCHEMA,
} from './mapRow.canonical';
import type {
  ParicionCanonical,
  LluviaCanonical,
  MortandadCanonical,
  PastoreoCanonical,
  CompraCanonical,
} from './types.canonical';

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
  // PRIMERA round-trip: usamos `count: 'exact'` para que Postgres devuelva
  // el total de filas junto con la primera página. Eso nos permite calcular
  // cuántas páginas faltan y lanzarlas en PARALELO en lugar de esperar
  // cada una secuencialmente (antes 2500 rows = 3 round-trips × 150ms =
  // ~450ms; ahora 2500 rows = 1 round-trip serial + 2 paralelos = ~200ms).
  //
  // Si la tabla cabe en una página (count <= PAGE_SIZE) ahorrramos la
  // segunda round-trip directamente y devolvemos.
  const baseFirst = supabase.from(table).select('*', { count: 'exact' });
  const orderedFirst = applyOrder(baseFirst) as ReturnType<typeof baseFirst.range>;
  const { data: firstData, error: firstErr, count } = await orderedFirst.range(0, PAGE_SIZE - 1);
  if (firstErr) throw firstErr;
  const first = (firstData ?? []) as T[];
  if (count == null || count <= PAGE_SIZE) return first;

  // Safeguard: contra count corrupto / explosión de paginación. 1M filas
  // sería un cliente fuera de cualquier perfil real, abortamos.
  const totalPages = Math.ceil(count / PAGE_SIZE);
  if (totalPages > 1000) {
    throw new Error(`fetchAllPaginated(${table}): >1M filas (count=${count}), abortando`);
  }

  // Lanzar páginas restantes en paralelo. Cada Promise hace su propia
  // request range(N, N+PAGE_SIZE-1) — el ordering se preserva porque
  // Postgres devuelve cada slot ordenado por la cláusula del applyOrder
  // y nosotros las concatenamos en orden de página.
  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 1);
  const restResults = await Promise.all(
    remainingPages.map(async (pageIdx) => {
      const base = supabase.from(table).select('*');
      const ordered = applyOrder(base);
      const start = pageIdx * PAGE_SIZE;
      const { data, error } = await ordered.range(start, start + PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as T[];
    }),
  );

  // Concatenar manteniendo orden: primera página + páginas siguientes.
  return [first, ...restResults].flat();
}

// Mappers de DB → tipo TS. Ahora son one-liners gracias a mapRow + SCHEMAs
// canónicos (asfion-web/src/data/mapRow.canonical.ts). Cuando agregás una
// columna nueva al schema canonical, este mapper se actualiza automático.
//
// Para campos específicos del dashboard (no canónicos) — ej. syncState en
// Paricion, gpsLat/gpsLon en Mortandad — el mapper devuelve `{...canonical, ...extras}`.

function rowToCampo(r: any): Campo {
  return mapRow<Campo>(r, CAMPO_SCHEMA);
}

function rowToParicion(r: any): Paricion {
  // syncState siempre es 'synced' en el dashboard — solo leemos rows ya
  // sincronizados desde la app móvil. El campo viene del repo web (no canonical).
  return {
    ...mapRow<ParicionCanonical>(r, PARICION_SCHEMA),
    syncState: 'synced',
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
  // El dashboard recibe `pluviometro_nombre` (computado por una view o join)
  // mientras que el canonical schema espera `pluviometro` directo. Reescribimos
  // antes de pasar a mapRow para que el SCHEMA sirva.
  return mapRow<Lluvia>(
    { ...r, pluviometro: r.pluviometro_nombre ?? r.pluviometro ?? '' },
    LLUVIA_SCHEMA,
  );
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
  // GPS está aplanado en el dashboard (no en el canonical). Lo agregamos
  // como extra después de mapRow para mantener el spec canónico limpio.
  return {
    ...mapRow<MortandadCanonical>(r, MORTANDAD_SCHEMA),
    gpsLat:        r.gps_lat        != null ? Number(r.gps_lat)        : undefined,
    gpsLon:        r.gps_lon        != null ? Number(r.gps_lon)        : undefined,
    gpsAccuracyM:  r.gps_accuracy_m != null ? Number(r.gps_accuracy_m) : undefined,
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
  return mapRow<Pastoreo>(r, PASTOREO_SCHEMA);
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
  return mapRow<Compra>(r, COMPRA_SCHEMA);
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
  return mapRow<Circuito>(r, CIRCUITO_SCHEMA);
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
