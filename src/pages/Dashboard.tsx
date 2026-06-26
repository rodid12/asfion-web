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
import { PastoreoModule } from './PastoreoModule';
import { ComprasPage } from './ComprasPage';
import { VentasPage } from './VentasPage';
import { PrenezPage, type Tacto } from './PrenezPage';
import { NdviPage } from './NdviPage';
import { BillingAdminPage } from './BillingAdminPage';

// Snapshot de los 7 rodeos tactados — tomado del sheet "Prenez" del GVA
// (Excel del cliente, version GVA_F(7).xlsx). Hardcodeado hasta que el
// veterinario tenga form de carga propio en la app móvil o se haga sync
// periódico de la planilla. Mismo enfoque que usamos con Stock Inicial.
const TACTOS_GVA: Tacto[] = [
  { id: 'p1', rodeo: 'VQ 27M Margarita',     origenTotal: 254, prenezCabeza: 123, prenezCuerpo:  86, prenezCola: 26, vacias: 19, perdon: 0, descarte: 0, feedLot: 0 },
  { id: 'p2', rodeo: 'Vaquillas 15M Ag',     origenTotal: 529, prenezCabeza: 336, prenezCuerpo:  96, prenezCola: 31, vacias: 65, perdon: 0, descarte: 0, feedLot: 0 },
  { id: 'p3', rodeo: 'Vaquillas 2° Serv C',  origenTotal: 540, prenezCabeza:   0, prenezCuerpo:   0, prenezCola:  0, vacias:  0, perdon: 0, descarte: 0, feedLot: 0 },
  { id: 'p4', rodeo: 'Vacas Carolina',       origenTotal: 416, prenezCabeza: 141, prenezCuerpo: 140, prenezCola: 86, vacias: 48, perdon: 0, descarte: 0, feedLot: 0 },
  { id: 'p5', rodeo: 'Vacas Progreso',       origenTotal: 418, prenezCabeza: 192, prenezCuerpo: 138, prenezCola: 58, vacias: 30, perdon: 0, descarte: 0, feedLot: 0 },
  { id: 'p6', rodeo: 'Vacas Picaflor IATF',  origenTotal: 557, prenezCabeza:   0, prenezCuerpo:   0, prenezCola:  0, vacias:  0, perdon: 0, descarte: 0, feedLot: 0 },
  { id: 'p7', rodeo: 'Vacas Picaflor Toro',  origenTotal: 358, prenezCabeza:   0, prenezCuerpo:   0, prenezCola:  0, vacias:  0, perdon: 0, descarte: 0, feedLot: 0 },
];
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
      {/* Header oscuro — rediseñado para que el logo se lea claro sobre
          navy (variante onDark, "ASF" en blanco) y la jerarquía sea más
          prolija. Bottom border naranja muy fina como acento de brand. */}
      <header className="bg-asfion-navyDeep text-white border-b-2 border-asfion-orange/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sm:gap-6">
          {/* Brand */}
          <div className="flex items-center gap-4 min-w-0">
            <Logo height={40} variant="onDark" />
            <div className="hidden md:block h-8 w-px bg-white/15" />
            <p className="text-xs text-asfion-orange italic hidden md:block whitespace-nowrap">
              Gestión integral del campo.
            </p>
          </div>

          {/* Acciones + sesión */}
          <div className="flex items-center gap-3">
            {showAdmin && (
              <button
                onClick={() => setView(v => (v === 'billing' ? 'modules' : 'billing'))}
                className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs font-bold transition ${
                  view === 'billing'
                    ? 'bg-asfion-orange text-asfion-navyDeep'
                    : 'bg-white/5 text-asfion-orange hover:bg-asfion-orange/20 ring-1 ring-asfion-orange/30'
                }`}
                title={view === 'billing' ? 'Volver al tablero' : 'Panel de cobranzas'}
              >
                <ShieldIcon size={13} />
                <span className="hidden sm:inline">
                  {view === 'billing' ? 'Tablero' : 'Cobranzas'}
                </span>
              </button>
            )}
            <button
              onClick={refresh}
              disabled={loading}
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition disabled:opacity-40"
              title="Refrescar datos"
            >
              <RefreshCwIcon size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Separador */}
            <div className="h-8 w-px bg-white/15" />

            {/* Sesión: avatar + email */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-asfion-orange text-asfion-navyDeep font-extrabold grid place-items-center shadow-sm">
                {initials}
              </div>
              <div className="text-right hidden sm:block leading-tight">
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Sesión</p>
                <p className="text-sm font-semibold truncate max-w-[200px]" title={user?.email ?? ''}>
                  {user?.email ?? '—'}
                </p>
              </div>
            </div>

            <button
              onClick={signOut}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition"
              title="Cerrar sesión"
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
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
          // PastoreoModule maneja internamente los 3 sub-tabs:
          //   Pastoreo (vista actual) · Entradas · Cierre Corrales.
          // Antes Corrales era tab top-level — se movió adentro porque
          // conceptualmente es parte del ciclo de pastoreo (la última etapa
          // antes de la venta).
          <PastoreoModule pastoreo={d.pastoreo} campos={d.campos} circuitos={d.circuitos} />
        )}
        {view === 'modules' && data && modulo === 'compras' && (
          // Compras = entradas de hacienda al sistema (proveedores).
          <ComprasPage compras={d.compras} campos={d.campos} />
        )}
        {view === 'modules' && data && modulo === 'ventas' && (
          // Ventas = salidas de hacienda (a frigorífico u otro productor).
          // Por ahora con empty state hasta enchufar fuente.
          <VentasPage ventas={[]} />
        )}
        {view === 'modules' && data && modulo === 'prenez' && (
          // Por ahora con snapshot del GVA (7 rodeos). Cuando el veterinario
          // tenga form en app móvil o sync periódico de su planilla, esto
          // pasa a venir de Supabase como los demás módulos.
          <PrenezPage tactos={TACTOS_GVA} />
        )}
        {view === 'modules' && data && modulo === 'ndvi' && (
          // NDVI/Materia Seca — empty state hasta que enchufemos una fuente
          // satelital (Auravant/Sentinel) o sync de planilla del agrónomo.
          // Pasamos los nombres de campos para alimentar el slicer de filtro.
          <NdviPage mediciones={[]} campos={d.campos.map(c => c.nombre)} />
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
