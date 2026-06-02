// Hook único que carga TODOS los módulos del dashboard en paralelo:
// campos + circuitos + pariciones + lluvias + mortandad + pastoreo.
//
// Es deliberadamente eager — la app real maneja <10k filas totales por
// cliente, y traer todo de una vez evita "click → spinner" cada vez que
// el usuario cambia de tab. Si en el futuro escalamos a 100k+, partimos
// en hooks por módulo y cargamos on-demand.

import { useEffect, useState } from 'react';
import type { Campo, Circuito, Compra, Lluvia, Mortandad, Paricion, Pastoreo } from './types';
import {
  fetchCampos,
  fetchCircuitos,
  fetchCompras,
  fetchLluvias,
  fetchMortandad,
  fetchPariciones,
  fetchPastoreo,
} from './supabase';

export interface DashboardData {
  campos: Campo[];
  circuitos: Circuito[];
  pariciones: Paricion[];
  lluvias: Lluvia[];
  mortandad: Mortandad[];
  pastoreo: Pastoreo[];
  compras: Compra[];
}

export interface UseDataResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const EMPTY: DashboardData = {
  campos: [],
  circuitos: [],
  pariciones: [],
  lluvias: [],
  mortandad: [],
  pastoreo: [],
  compras: [],
};

export function useDashboardData(): UseDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [campos, circuitos, pariciones, lluvias, mortandad, pastoreo, compras] =
          await Promise.all([
            fetchCampos(),
            fetchCircuitos(),
            fetchPariciones(),
            fetchLluvias(),
            fetchMortandad(),
            fetchPastoreo(),
            fetchCompras(),
          ]);
        if (!cancelled) {
          setData({ campos, circuitos, pariciones, lluvias, mortandad, pastoreo, compras });
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Error desconocido cargando datos');
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
    refresh: () => setNonce(n => n + 1),
  };
}

// Default vacío para que las pages no tengan que chequear null.
export { EMPTY as EMPTY_DATA };
