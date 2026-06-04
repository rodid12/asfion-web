// Shell del dashboard: header (branding + sesión + refresh + salir) + tabs
// por módulo + contenido. La página activa se decide por el state local
// `modulo`. No hay router — el dashboard es single-page por diseño.

import React, { useState } from 'react';
import { LogOutIcon, RefreshCwIcon, ShieldIcon } from 'lucide-react';
import { useDashboardData, EMPTY_DATA } from '@/data/useData';
import { useAuth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/billing';
import { ModuleTabs, type ModuleKey } from '@/components/ModuleTabs';
import { ParicionesPage } from './ParicionesPage';
import { LluviasPage } from './LluviasPage';
import { MortandadPage } from './MortandadPage';
import { PastoreoPage } from './PastoreoPage';
import { ComprasPage } from './ComprasPage';
import { CorralesPage } from './CorralesPage';
import { BillingAdminPage } from './BillingAdminPage';
import { Logo } from '@/components/Logo';

type View = 'modules' | 'billing';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const { data, loading, error, refresh } = useDashboardData();
  const [modulo, setModulo] = useState<ModuleKey>('pariciones');
  // 'modules' = vista operativa normal (tabs + pages). 'billing' = panel de
  // cobranzas, solo accesible para super-admin. Lo guardamos en state local
  // (single-page, sin router) — al cerrar el browser se reinicia a 'modules'.
  const [view, setView] = useState<View>('modules');
  const showAdmin = isSuperAdmin(user?.email);

  const d = data ?? EMPTY_DATA;
  const initials = (user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-asfion-bg">
      {/* Header oscuro */}
      <header className="bg-asfion-navyDeep text-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo height={36} />
            <p className="text-xs text-asfion-orange italic hidden sm:block">
              Del campo al tablero, sin fricción.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {showAdmin && (
              <button
                onClick={() => setView(v => (v === 'billing' ? 'modules' : 'billing'))}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  view === 'billing'
                    ? 'bg-asfion-orange text-asfion-navyDeep'
                    : 'bg-asfion-orange/15 text-asfion-orange hover:bg-asfion-orange/25'
                }`}
                title={view === 'billing' ? 'Volver al tablero' : 'Panel de cobranzas'}
              >
                <ShieldIcon size={13} />
                {view === 'billing' ? 'Tablero' : 'Cobranzas'}
              </button>
            )}
            <button
              onClick={refresh}
              disabled={loading}
              className="text-asfion-orange/70 hover:text-asfion-orange transition disabled:opacity-40"
              title="Refrescar datos"
            >
              <RefreshCwIcon size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="text-right">
              <p className="text-xs uppercase text-asfion-orange/70">Sesión</p>
              <p className="text-sm font-semibold">{user?.email ?? '—'}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-asfion-orange text-asfion-navyDeep font-extrabold grid place-items-center">
              {initials}
            </div>
            <button
              onClick={signOut}
              className="ml-1 text-asfion-orange/70 hover:text-asfion-orange transition"
              title="Salir"
            >
              <LogOutIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs por módulo — solo en la vista de operaciones (la de billing
          es una página independiente sin tabs). */}
      {view === 'modules' && (
        <ModuleTabs
          active={modulo}
          onChange={setModulo}
          counts={{
            pariciones: d.pariciones.length,
            lluvias:    d.lluvias.length,
            mortandad:  d.mortandad.length,
            pastoreo:   d.pastoreo.length,
            compras:    d.compras.length,
          }}
        />
      )}

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Estado de error global */}
        {error && (
          <div className="rounded-xl border border-asfion-danger/30 bg-asfion-danger/10 px-4 py-3 text-sm text-asfion-danger">
            <strong>Error cargando datos:</strong> {error}
            <button onClick={refresh} className="ml-3 underline font-semibold">
              Reintentar
            </button>
          </div>
        )}

        {/* Skeleton mientras carga la primera vez (solo en vista operativa) */}
        {view === 'modules' && loading && !data && <LoadingSkeleton />}

        {/* Vista de cobranzas (solo super-admin) */}
        {view === 'billing' && showAdmin && <BillingAdminPage />}

        {/* Vista operativa: página activa según tab */}
        {view === 'modules' && data && modulo === 'pariciones' && (
          <ParicionesPage pariciones={d.pariciones} campos={d.campos} />
        )}
        {view === 'modules' && data && modulo === 'lluvias' && (
          <LluviasPage lluvias={d.lluvias} campos={d.campos} />
        )}
        {view === 'modules' && data && modulo === 'mortandad' && (
          <MortandadPage mortandad={d.mortandad} campos={d.campos} />
        )}
        {view === 'modules' && data && modulo === 'pastoreo' && (
          <PastoreoPage pastoreo={d.pastoreo} campos={d.campos} circuitos={d.circuitos} />
        )}
        {view === 'modules' && data && modulo === 'compras' && (
          <ComprasPage compras={d.compras} campos={d.campos} />
        )}
        {view === 'modules' && data && modulo === 'corrales' && (
          // corrales=[] hasta que se conecte la fuente (Google Sheets o app móvil).
          // La página maneja el empty state internamente.
          <CorralesPage corrales={[]} />
        )}

        <footer className="text-center text-xs text-asfion-muted py-6">
          ASFION · Dashboard v0.4 · Conectado a Supabase
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
