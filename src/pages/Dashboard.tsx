// Shell del dashboard: header (branding + sesión + refresh + salir) + tabs
// por módulo + contenido. La página activa se decide por el state local
// `modulo`. No hay router — el dashboard es single-page por diseño.

import React, { useEffect, useState } from 'react';
import { LogOutIcon, RefreshCwIcon, ShieldIcon } from 'lucide-react';
import { useDashboardData, EMPTY_DATA } from '@/data/useData';
import { useAuth } from '@/lib/auth';
import { useIsSuperAdmin } from '@/lib/billing';
import { ModuleTabs, type ModuleKey } from '@/components/ModuleTabs';
import { parseCurrentPath, pushPath } from '@/lib/routing';
import { ParicionesPage } from './ParicionesPage';
import { LluviasPage } from './LluviasPage';
import { MortandadPage } from './MortandadPage';
import { PastoreoModule } from './PastoreoModule';
import { ComprasPage } from './ComprasPage';
import { VentasPage } from './VentasPage';
import { PrenezPage } from './PrenezPage';
import { NdviPage } from './NdviPage';
import { BillingAdminPage } from './BillingAdminPage';

// (Antes había acá un array literal TACTOS_GVA con 7 rodeos de Ganaderas
//  hardcodeado. Fue movido a la tabla `tactos` de Supabase via migration
//  0012 con RLS por cliente_id, para que cada tenant vea solo los suyos
//  y no haya leak cross-tenant.)
import { Logo } from '@/components/Logo';
import { ClientesAdminPage } from './ClientesAdminPage';
import { UsersIcon } from 'lucide-react';

type View = 'modules' | 'billing' | 'admin';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const { data, loading, error, refresh, offline, cachedAt } = useDashboardData();
  // Inicializamos el state leyendo la URL actual — así si el operario
  // entra directo a /mortandad o refresca la pestaña, arranca en el
  // módulo que estaba. Default: pariciones (también para "/").
  const initial = parseCurrentPath();
  const [modulo, setModulo] = useState<ModuleKey>(initial.modulo);
  const [view, setView] = useState<View>(initial.view);
  const showAdmin = useIsSuperAdmin(user?.email);

  // Sincroniza URL → state cuando el usuario usa back/forward del browser.
  // Sin esto, click en "atrás" cambiaría la URL pero el state quedaría
  // pegado en el módulo anterior.
  useEffect(() => {
    const onPopState = () => {
      const r = parseCurrentPath();
      setView(r.view);
      setModulo(r.modulo);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Sincroniza state → URL cuando el usuario hace click en una tab.
  // pushPath dedupea automáticamente si la URL ya está alineada.
  useEffect(() => {
    pushPath(view, modulo);
  }, [view, modulo]);

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
              <>
                <button
                  onClick={() => setView(v => (v === 'admin' ? 'modules' : 'admin'))}
                  className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs font-bold transition ${
                    view === 'admin'
                      ? 'bg-asfion-orange text-asfion-navyDeep'
                      : 'bg-white/5 text-asfion-orange hover:bg-asfion-orange/20 ring-1 ring-asfion-orange/30'
                  }`}
                  title={view === 'admin' ? 'Volver al tablero' : 'Gestión de clientes'}
                >
                  <UsersIcon size={13} />
                  <span className="hidden sm:inline">
                    {view === 'admin' ? 'Tablero' : 'Clientes'}
                  </span>
                </button>
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
              </>
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

        {/* Banner "Sin conexión" — visible cuando estamos mostrando data
            del cache offline. Cuando vuelve la red, refresh() la actualiza
            y este banner desaparece. */}
        {offline && cachedAt && (
          <div className="rounded-xl border border-asfion-orange/40 bg-asfion-orangeSoft/40 px-4 py-3 text-sm text-asfion-navyDeep flex flex-wrap items-center gap-3">
            <span className="text-base">📡</span>
            <div className="flex-1 min-w-0">
              <strong>Sin conexión</strong> — mostrando datos del{' '}
              <span className="tabular-nums font-semibold">{formatCachedAt(cachedAt)}</span>.
              <span className="text-asfion-muted hidden sm:inline"> Cuando vuelva la señal, refrescá para ver lo último.</span>
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-asfion-orange text-white hover:opacity-90 transition disabled:opacity-50"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Skeleton mientras carga la primera vez (solo en vista operativa) */}
        {view === 'modules' && loading && !data && <LoadingSkeleton />}

        {/* Vista de cobranzas (solo super-admin) */}
        {view === 'billing' && showAdmin && <BillingAdminPage />}
        {view === 'admin'   && showAdmin && <ClientesAdminPage />}

        {/* Vista operativa: página activa según tab */}
        {view === 'modules' && data && modulo === 'pariciones' && (
          <ParicionesPage
            pariciones={d.pariciones}
            campos={d.campos}
            resumenServicio={d.resumenServicio}
          />
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
          <PastoreoModule
            pastoreo={d.pastoreo}
            pastoreoCiclos={d.pastoreoCiclos}
            campos={d.campos}
            circuitos={d.circuitos}
            corrales={d.corrales}
          />
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
          // Tactos vienen de Supabase (tabla `tactos`, migration 0012).
          // RLS por cliente_id garantiza que cada tenant vea solo los
          // suyos. Si la tabla no existe todavía, fetchTactos devuelve
          // [] y PrenezPage muestra su empty state.
          <PrenezPage tactos={d.tactos} />
        )}
        {view === 'modules' && data && modulo === 'ndvi' && (
          // NDVI/Materia Seca — data real desde Supabase tabla ndvi_pasturas.
          // Si la migración 0009 todavía no se aplicó, viene array vacío y
          // la página muestra el empty state.
          <NdviPage mediciones={d.ndvi} campos={d.campos.map(c => c.nombre)} />
        )}

        <footer className="text-center text-xs text-asfion-muted py-6">
          ASFION · Dashboard v0.4 · Conectado a Supabase
        </footer>
      </main>
    </div>
  );
}

// Formato amigable para el badge "Sin conexión — datos del DD/MM HH:MM".
// Si fue hace menos de 1 hora, "hace X min" para sentir más cerca.
function formatCachedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (diffMin < 1) return 'recién';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const pad = (n: number) => String(n).padStart(2, '0');
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const hh = pad(d.getHours());
  const mn = pad(d.getMinutes());
  // Si fue HOY, solo la hora. Si fue otro día, DD/MM HH:MM.
  const esHoy = d.toDateString() === now.toDateString();
  return esHoy ? `hoy ${hh}:${mn}` : `${dd}/${mm} ${hh}:${mn}`;
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
