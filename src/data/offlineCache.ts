// Cache offline del dashboard.
//
// Guarda la última `DashboardData` completa en IndexedDB después de cada
// fetch exitoso contra Supabase. Si el próximo load NO tiene internet (o
// Supabase está caído), useDashboardData restaura desde acá y muestra
// un badge "Sin conexión — datos del DD/MM HH:MM".
//
// Implementación con `idb-keyval`: key/value store sobre IndexedDB,
// sin schema ni migrations. Está pensado para 1 sólo registro grande
// (la `DashboardData` completa serializada como JSON).
//
// Por qué IndexedDB y no localStorage:
//   - localStorage tiene cap de ~5 MB por origen y guarda como string.
//   - El dataset de Ganaderas hoy: ~2500 pariciones + 400 lluvias + 300
//     pastoreos + etc = unos 2-3 MB serializados. Crece rápido.
//   - IndexedDB sirve para 50+ MB sin pestañear y no bloquea el main
//     thread al escribir.
//
// Esquema del valor:
//   {
//     savedAt: ISO string,    // cuándo se guardó (para el badge)
//     data:    DashboardData, // payload completo
//     version: number,        // por si en el futuro cambia el shape
//   }
//
// Si la versión guardada no matchea con CACHE_VERSION, ignoramos el
// cache (= se trata como "no hay cache") y al próximo fetch online se
// pisa con la nueva versión.

// @ts-ignore: idb-keyval se instala con `npm install` después de agregarlo
// a package.json. El @ts-ignore evita warnings cuando se levanta el repo
// por primera vez sin haber corrido install todavía.
import { get, set, del } from 'idb-keyval';
import type { DashboardData } from './useData';

const CACHE_KEY = 'asfion:dashboard-data';
// Bump esto cuando cambies el shape de DashboardData (ej. agregás un
// nuevo módulo). El cache viejo se descarta y se regenera.
const CACHE_VERSION = 2;

interface CacheEntry {
  savedAt: string;
  data: DashboardData;
  version: number;
}

/** Guarda la data en IndexedDB. Falla silenciosa (no rompe la app). */
export async function saveCache(data: DashboardData): Promise<void> {
  try {
    const entry: CacheEntry = {
      savedAt: new Date().toISOString(),
      data,
      version: CACHE_VERSION,
    };
    await set(CACHE_KEY, entry);
  } catch (err) {
    // IndexedDB puede fallar en modo incógnito de Safari, o cuando el
    // browser está sin espacio. No es crítico — el dashboard sigue
    // funcionando, solo no tiene cache offline.
    console.warn('[offlineCache] no se pudo guardar:', err);
  }
}

/** Lee la data cacheada. Devuelve null si no existe o si la versión
 *  guardada no matchea con la actual. */
export async function loadCache(): Promise<{ data: DashboardData; savedAt: string } | null> {
  try {
    const entry = await get<CacheEntry>(CACHE_KEY);
    if (!entry) return null;
    if (entry.version !== CACHE_VERSION) {
      // Cache de versión vieja — ignoramos y borramos para liberar espacio.
      void del(CACHE_KEY);
      return null;
    }
    return { data: entry.data, savedAt: entry.savedAt };
  } catch (err) {
    console.warn('[offlineCache] no se pudo leer:', err);
    return null;
  }
}

/** Borra el cache (útil para debug o cuando el usuario cierra sesión). */
export async function clearCache(): Promise<void> {
  try {
    await del(CACHE_KEY);
  } catch (err) {
    console.warn('[offlineCache] no se pudo limpiar:', err);
  }
}
