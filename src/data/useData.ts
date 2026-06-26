// Hook único que carga TODOS los módulos del dashboard en paralelo:
// campos + circuitos + pariciones + lluvias + mortandad + pastoreo + compras + ndvi.
//
// Es deliberadamente eager — la app real maneja <10k filas totales por
// cliente, y traer todo de una vez evita "click → spinner" cada vez que
// el usuario cambia de tab. Si en el futuro escalamos a 100k+, partimos
// en hooks por módulo y cargamos on-demand.
//
// OFFLINE: después de cada fetch exitoso guardamos la `DashboardData`
// entera en IndexedDB. Si el próximo load no tiene internet, el hook
// restaura desde ese cache y expone `offline=true` + `cachedAt` para
// que el UI muestre el badge "Sin conexión — datos del DD/MM HH:MM".

import { useEffect, useState } from 'react';
import type { Campo, Circuito, Compra, Lluvia, Mortandad, NdviPastura, Paricion, Pastoreo, Tacto } from './types';
import {
  fetchCampos,
  fetchCircuitos,
  fetchCompras,
  fetchLluvias,
  fetchMortandad,
  fetchNdvi,
  fetchPariciones,
  fetchPastoreo,
  fetchTactos,
} from './supabase';
import { loadCache, saveCache } from './offlineCache';

export interface DashboardData {
  campos: Campo[];
  circuitos: Circuito[];
  pariciones: Paricion[];
  lluvias: Lluvia[];
  mortandad: Mortandad[];
  pastoreo: Pastoreo[];
  compras: Compra[];
  ndvi: NdviPastura[];
  tactos: Tacto[];
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
}

const EMPTY: DashboardData = {
  campos: [],
  circuitos: [],
  pariciones: [],
  lluvias: [],
  mortandad: [],
  pastoreo: [],
  compras: [],
  ndvi: [],
  tactos: [],
};

export function useDashboardData(): UseDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // ESTRATEGIA "stale-while-revalidate":
      //   1. Intentamos leer el cache de IndexedDB INMEDIATAMENTE.
      //      Si hay, mostramos esa data (con flag offline=true como
      //      indicación visual de que es vieja).
      //   2. En paralelo intentamos fetchear de Supabase.
      //   3. Si el fetch funciona → reemplazamos con data fresca y
      //      borramos el flag offline. También guardamos el nuevo
      //      cache en IndexedDB para la próxima vez.
      //   4. Si el fetch falla (sin internet, Supabase caído) →
      //      mantenemos la data del cache y mostramos error solo si
      //      tampoco había cache (= primer load del usuario sin red).
      setLoading(true);
      setError(null);

      // 1. Cache primero — pintamos pantalla rápido aunque sea con data vieja.
      const cached = await loadCache();
      if (!cancelled && cached) {
        setData(cached.data);
        setOffline(true);          // se va a apagar si el fetch online tiene éxito
        setCachedAt(cached.savedAt);
        setLoading(false);         // ya hay algo para mostrar, no bloqueamos
      }

      // 2-4. Fetch online en paralelo (o secuencial si no había cache).
      try {
        const [campos, circuitos, pariciones, lluvias, mortandad, pastoreo, compras, ndvi, tactos] =
          await Promise.all([
            fetchCampos(),
            fetchCircuitos(),
            fetchPariciones(),
            fetchLluvias(),
            fetchMortandad(),
            fetchPastoreo(),
            fetchCompras(),
            fetchNdvi(),
            fetchTactos(),
          ]);
        if (cancelled) return;
        const fresh: DashboardData = { campos, circuitos, pariciones, lluvias, mortandad, pastoreo, compras, ndvi, tactos };
        setData(fresh);
        setOffline(false);
        setCachedAt(null);
        // Guardar para la próxima vez — fire & forget.
        void saveCache(fresh);
      } catch (err: any) {
        if (cancelled) return;
        // El fetch online falló. Hay 2 sub-casos:
        //   - Había cache → ya lo mostramos; solo dejamos offline=true.
        //   - No había cache → es la primera vez que el user abre y no
        //     tiene internet. Mostramos error.
        if (!cached) {
          setError(err?.message ?? 'Error desconocido cargando datos');
        }
        // Si había cache, el badge "Sin conexión" ya está visible.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [nonce]);

  return {
    data,
    loading,
    error,
    offline,
    cachedAt,
    refresh: () => setNonce(n => n + 1),
  };
}

// Default vacío para que las pages no tengan que chequear null.
export { EMPTY as EMPTY_DATA };
