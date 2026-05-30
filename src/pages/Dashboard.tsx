// Shell del dashboard: header (branding + sesión + refresh + salir) + tabs
// por módulo + contenido. La página activa se decide por el state local
// `modulo`. No hay router — el dashboard es single-page por diseño.

import React, { useState } from 'react';
import { LogOutIcon, RefreshCwIcon } from 'lucide-react';
import { useDashboardData, EMPTY_DATA } from '@/data/useData';
import { useAuth } from '@/lib/auth';
import { ModuleTabs, type ModuleKey } from '@/components/ModuleTabs';
import { ParicionesPage } from './ParicionesPage';
import { LluviasPage } from './LluviasPage';
import { MortandadPage } from './MortandadPage';
import { PastoreoPage } from './PastoreoPage';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const { data, loading, error, refresh } = useDashboardData();
  const [modulo, setModulo] = useState<ModuleKey>('pariciones');

  const d = data ?? EMPTY_DATA;
  const initials = (user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-asfion-bg">
      {/* Header oscuro */}
      <header className="bg-asfion-deep text-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-asfion-lime" />
            <div>
              <h1 className="text-xl font-extrabold tracking-wide">ASFION</h1>
              <p className="text-xs text-asfion-lime italic">Del campo al tablero, sin fricción.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={refresh}
              disabled={loading}
              className="text-asfion-lime/70 hover:text-asfion-lime transition disabled:opacity-40"
              title="Refrescar datos"
            >
              <RefreshCwIcon size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="text-right">
              <p className="text-xs uppercase text-asfion-lime/70">Sesión</p>
              <p className="text-sm font-semibold">{user?.email ?? '—'}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-asfion-lime text-asfion-deep font-extrabold grid place-items-center">
              {initials}
            </div>
            <button
              onClick={signOut}
              className="ml-1 text-asfion-lime/70 hover:text-asfion-lime transition"
              title="Salir"
            >
              <LogOutIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs por módulo — sticky para no perderlas al scrollear */}
      <ModuleTabs
        active={modulo}
        onChange={setModulo}
        counts={{
          pariciones: d.pariciones.length,
          lluvias:    d.lluvias.length,
          mortandad:  d.mortandad.length,
          pastoreo:   d.pastoreo.length,
        }}
      />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Estado de error global */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-asfion-danger">
            <strong>Error cargando datos:</strong> {error}
            <button onClick={refresh} className="ml-3 underline font-semibold">
              Reintentar
            </button>
          </div>
        )}

        {/* Skeleton mientras carga la primera vez */}
        {loading && !data && <LoadingSkeleton />}

        {/* Página activa */}
        {data && modulo === 'pariciones' && (
          <ParicionesPage pariciones={d.pariciones} campos={d.campos} />
        )}
        {data && modulo === 'lluvias' && (
          <LluviasPage lluvias={d.lluvias} campos={d.campos} />
        )}
        {data && modulo === 'mortandad' && (
          <MortandadPage mortandad={d.mortandad} campos={d.campos} />
        )}
        {data && modulo === 'pastoreo' && (
          <PastoreoPage pastoreo={d.pastoreo} campos={d.campos} circuitos={d.circuitos} />
        )}

        <footer className="text-center text-xs text-asfion-muted py-6">
          ASFION · Dashboard v0.3 · Conectado a Supabase
        </footer>
      </main>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 bg-white rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-white rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-72 bg-white rounded-xl lg:col-span-2" />
        <div className="h-72 bg-white rounded-xl" />
      </div>
      <div className="h-96 bg-white rounded-xl" />
    </div>
  );
}
