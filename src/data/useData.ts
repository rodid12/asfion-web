// Hook único que carga TODOS los módulos del dashboard en paralelo:
// catálogos + pariciones + lluvias + mortandad + pastoreo + compras + ventas + NDVI.
//
// Es deliberadamente eager — la app real maneja <10k filas totales por
// cliente, y traer todo de una vez evita "click → spinner" cada vez que
// el usuario cambia de tab. Si en el futuro escalamos a 100k+, partimos
// en hooks por módulo y cargamos on-demand.
//
// OFFLINE: después de cada fetch exitoso guardamos la `DashboardData`
// entera en IndexedDB. Si el próximo load no tiene internet, el hook
// restaura desde ese cache. Solo expone `offline=true` cuando el intento de
// actualizar contra Supabase falla; leer el cache primero no significa que
// el navegador esté sin conexión.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CampaniaOperativa, CampaniaReproductiva, Campo, Circuito, Compra, Corral, Lluvia, Mortandad, NdviPastura, Paricion, Pastoreo, PastoreoCiclo, ResumenServicio, Tacto, Venta } from './types';
import {
  fetchCampos,
  fetchCampaniasOperativas,
  fetchCampaniasReproductivas,
  fetchCircuitos,
  fetchCompras,
  fetchLluvias,
  fetchMortandad,
  fetchNdvi,
  fetchPariciones,
  fetchPastoreo,
  fetchPastoreoCiclos,
  fetchResumenServicio,
  fetchTactos,
  fetchCorrales,
  fetchVentas,
} from './supabase';
import { loadCache, saveCache } from './offlineCache';
import { setAdminClienteRequestScope } from '@/lib/supabase';

export interface DashboardData {
  campos: Campo[];
  campaniasOperativas: CampaniaOperativa[];
  campaniasReproductivas: CampaniaReproductiva[];
  circuitos: Circuito[];
  pariciones: Paricion[];
  lluvias: Lluvia[];
  mortandad: Mortandad[];
  pastoreo: Pastoreo[];
  pastoreoCiclos: PastoreoCiclo[];
  resumenServicio: ResumenServicio[];
  compras: Compra[];
  ndvi: NdviPastura[];
  tactos: Tacto[];
  corrales: Corral[];
  ventas: Venta[];
}

export interface UseDataResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** True si la data que estamos mostrando vino del cache offline
   *  (porque fetchear Supabase falló — capaz por falta de internet). */
  offline: boolean;
  /** Cuándo se guardó el cache que estamos mostrando, en ISO. Null
   *  si la data es fresca de Supabase (no de cache). */
  cachedAt: string | null;
  /** Última respuesta exitosa conocida para el scope actual. Puede ser la
   *  fecha del cache durante una revalidación o la del fetch recién terminado. */
  lastUpdatedAt: string | null;
}

const EMPTY: DashboardData = {
  campos: [],
  campaniasOperativas: [],
  campaniasReproductivas: [],
  circuitos: [],
  pariciones: [],
  lluvias: [],
  mortandad: [],
  pastoreo: [],
  pastoreoCiclos: [],
  resumenServicio: [],
  compras: [],
  ndvi: [],
  tactos: [],
  corrales: [],
  ventas: [],
};

export function useDashboardData(
  cacheScope: string,
  clienteId?: string,
  enabled = true,
): UseDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce(n => n + 1), []);
  const ultimoScope = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const scopeActual = `${cacheScope}|${clienteId ?? ''}|${enabled ? '1' : '0'}`;
    const mismoScope = ultimoScope.current === scopeActual;
    const revalidacionSilenciosa = nonce > 0 && mismoScope && data !== null;
    ultimoScope.current = scopeActual;

    // Un super-admin todavía sin tenant elegido no debe consultar "todo".
    // Esperamos a tener un cliente explícito antes de tocar cache o Supabase.
    if (!enabled) {
      setAdminClienteRequestScope(null);
      setData(null);
      setLoading(true);
      setError(null);
      setOffline(false);
      setCachedAt(null);
      setLastUpdatedAt(null);
      return () => { cancelled = true; };
    }

    // Debe definirse antes de crear cualquiera de las consultas paralelas.
    // Para usuarios normales clienteId es undefined y la RLS usa el tenant del
    // JWT. Para super-admins identifica el único tenant elegido en el selector.
    setAdminClienteRequestScope(clienteId ?? null);

    (async () => {
      // ESTRATEGIA "stale-while-revalidate":
      //   1. Intentamos leer el cache de IndexedDB INMEDIATAMENTE.
      //      Si hay, mostramos esa data mientras validamos en segundo plano,
      //      pero no la marcamos como offline: todavía no probamos la red.
      //   2. En paralelo intentamos fetchear de Supabase.
      //   3. Si el fetch funciona → reemplazamos con data fresca y
      //      borramos el flag offline. También guardamos el nuevo
      //      cache en IndexedDB para la próxima vez.
      //   4. Si el fetch falla (sin internet, Supabase caído) →
      //      mantenemos la data del cache y mostramos error solo si
      //      tampoco había cache (= primer load del usuario sin red).
      // Al cambiar de tenant limpiamos primero la data anterior. Así nunca se
      // muestran durante unos milisegundos métricas del cliente previo bajo el
      // nombre del nuevo cliente.
      // En la carga inicial o al cambiar de cliente limpiamos la pantalla.
      // En una revalidación (botón Refrescar, volver a la pestaña del browser)
      // mantenemos los datos visibles y actualizamos silenciosamente: antes
      // cada focus volvía a mostrar cache/spinner y parecía un reload completo.
      if (!revalidacionSilenciosa) {
        setData(null);
        setLoading(true);
        setCachedAt(null);
        setLastUpdatedAt(null);
      }
      setError(null);
      setOffline(false);

      // 1. Cache primero — pintamos pantalla rápido aunque sea con data vieja.
      const cached = revalidacionSilenciosa ? null : await loadCache(cacheScope);
      if (!cancelled && cached) {
        setData(cached.data);
        setOffline(false);
        setCachedAt(cached.savedAt);
        setLastUpdatedAt(cached.savedAt);
        // Conservamos loading=true: la pantalla puede mostrar el cache, pero
        // debe dejar claro que todavía está revalidando contra Supabase.
      }

      // 2-4. Fetch online en paralelo (o secuencial si no había cache).
      try {
        const [campos, campaniasOperativas, campaniasReproductivas, circuitos, pariciones, lluvias, mortandad, pastoreo, pastoreoCiclos, resumenServicio, compras, ndvi, tactos, corrales, ventas] =
          await Promise.all([
            fetchCampos(clienteId),
            fetchCampaniasOperativas(clienteId),
            fetchCampaniasReproductivas(clienteId),
            fetchCircuitos(clienteId),
            fetchPariciones(clienteId),
            fetchLluvias(clienteId),
            fetchMortandad(clienteId),
            fetchPastoreo(clienteId),
            fetchPastoreoCiclos(clienteId),
            fetchResumenServicio(clienteId),
            fetchCompras(clienteId),
            fetchNdvi(clienteId),
            fetchTactos(clienteId),
            fetchCorrales(clienteId),
            fetchVentas(clienteId),
          ]);
        if (cancelled) return;
        const fresh: DashboardData = { campos, campaniasOperativas, campaniasReproductivas, circuitos, pariciones, lluvias, mortandad, pastoreo, pastoreoCiclos, resumenServicio, compras, ndvi, tactos, corrales, ventas };
        setData(fresh);
        setOffline(false);
        setCachedAt(null);
        setLastUpdatedAt(new Date().toISOString());
        // Guardar para la próxima vez — fire & forget.
        void saveCache(fresh, cacheScope);
      } catch (err: any) {
        if (cancelled) return;
        // El fetch online falló. Hay 2 sub-casos:
        //   - Había cache → ya lo mostramos; recién ahora marcamos offline.
        //   - No había cache → es la primera vez que el user abre y no
        //     tiene internet. Mostramos error.
        if (cached) {
          setOffline(true);
        } else if (!revalidacionSilenciosa) {
          setError(err?.message ?? 'Error desconocido cargando datos');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // `data` se usa únicamente para decidir si el refresh puede ser silencioso.
  // No se incluye como dependencia: la propia carga actualiza `data` y volvería
  // a disparar el fetch en un bucle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, cacheScope, clienteId, enabled]);

  return {
    data,
    loading,
    error,
    offline,
    cachedAt,
    lastUpdatedAt,
    refresh,
  };
}

// Default vacío para que las pages no tengan que chequear null.
export { EMPTY as EMPTY_DATA };
