// Shell del dashboard: header (branding + sesión + refresh + salir) + tabs
// por módulo + contenido. La página activa se decide por el state local
// `modulo`. No hay router — el dashboard es single-page por diseño.

import React, { useEffect, useMemo, useState } from 'react';
import { LogOutIcon, RefreshCwIcon, ShieldIcon } from 'lucide-react';
import { useDashboardData, EMPTY_DATA } from '@/data/useData';
import { useAuth } from '@/lib/auth';
import { useSuperAdminStatus } from '@/lib/billing';
import { ModuleTabs, type ModuleKey } from '@/components/ModuleTabs';
import { ClienteScopeSelector } from '@/components/ClienteScopeSelector';
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
import { adminListClientes, type ClienteAdminRow } from '@/data/admin';
import { CampaniaOperativaBar } from '@/components/CampaniaOperativaBar';
import {
  campaniasOperativasFallback,
  asegurarCampaniaDeHoy,
  completarCampaniasDesdeFechas,
  elegirCampaniaActual,
  enCampania,
  finReproductivo,
  reproductivaParaOperativa,
  solapaCampania,
} from '@/lib/campanias';

type View = 'modules' | 'billing' | 'admin';

export function Dashboard() {
  const { user, signOut } = useAuth();
  // El claim sirve como namespace para usuarios normales. Los super-admins
  // eligen un tenant explícito más abajo; jamás consultan todos a la vez.
  const clienteClaim = String(
    user?.app_metadata?.cliente_id ?? user?.user_metadata?.cliente_id ?? 'sin-cliente',
  );
  const adminStatus = useSuperAdminStatus(user?.email);
  const showAdmin = adminStatus === true;
  const [clientesDisponibles, setClientesDisponibles] = useState<ClienteAdminRow[]>([]);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string | null>(null);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clientesError, setClientesError] = useState<string | null>(null);
  const [clientesNonce, setClientesNonce] = useState(0);

  // Carga el catálogo de tenants únicamente para dueños/super-admins. La
  // prioridad inicial es: URL compartida → selección anterior → claim del JWT
  // → Ganaderas → primer cliente disponible.
  useEffect(() => {
    if (adminStatus !== true) {
      if (adminStatus === false) {
        setClientesDisponibles([]);
        setClienteSeleccionadoId(null);
        setClientesError(null);
      }
      return;
    }

    let cancelado = false;
    setClientesLoading(true);
    setClientesError(null);

    adminListClientes()
      .then(clientes => {
        if (cancelado) return;
        setClientesDisponibles(clientes);
        const ids = new Set(clientes.map(cliente => cliente.id));
        const urlCliente = new URLSearchParams(window.location.search).get('cliente');
        const guardado = window.localStorage.getItem(adminScopeStorageKey(user?.email));

        setClienteSeleccionadoId(anterior => {
          const elegido = [urlCliente, anterior, guardado, clienteClaim, 'ganaderas', clientes[0]?.id]
            .find((id): id is string => Boolean(id && ids.has(id))) ?? null;
          if (elegido) {
            window.localStorage.setItem(adminScopeStorageKey(user?.email), elegido);
            writeClienteToUrl(elegido);
          }
          return elegido;
        });
      })
      .catch((err: any) => {
        if (!cancelado) {
          setClientesError(err?.message ?? 'No se pudo cargar la lista de clientes.');
          setClienteSeleccionadoId(null);
        }
      })
      .finally(() => {
        if (!cancelado) setClientesLoading(false);
      });

    return () => { cancelado = true; };
  }, [adminStatus, clienteClaim, clientesNonce, user?.email]);

  const cambiarCliente = (clienteId: string) => {
    if (!clientesDisponibles.some(cliente => cliente.id === clienteId)) return;
    setClienteSeleccionadoId(clienteId);
    window.localStorage.setItem(adminScopeStorageKey(user?.email), clienteId);
    writeClienteToUrl(clienteId);
  };

  // Usuario + tenant forman el namespace del cache offline. Para un
  // super-admin el scope seleccionado también viaja en TODAS las queries.
  const dataClienteId = showAdmin ? (clienteSeleccionadoId ?? undefined) : undefined;
  const dashboardEnabled = adminStatus === false || (showAdmin && Boolean(clienteSeleccionadoId));
  const cacheTenant = showAdmin ? (clienteSeleccionadoId ?? 'seleccionando') : clienteClaim;
  const cacheScope = `${user?.id ?? 'sin-sesion'}:${cacheTenant}`;
  const { data, loading, error, refresh, offline, cachedAt } = useDashboardData(
    cacheScope,
    dataClienteId,
    dashboardEnabled,
  );
  // Inicializamos el state leyendo la URL actual — así si el operario
  // entra directo a /mortandad o refresca la pestaña, arranca en el
  // módulo que estaba. Default: pariciones (también para "/").
  const initial = parseCurrentPath();
  const [modulo, setModulo] = useState<ModuleKey>(initial.modulo);
  const [view, setView] = useState<View>(initial.view);
  const fallbackCampanias = useMemo(() => campaniasOperativasFallback(), []);
  const [campaniaId, setCampaniaId] = useState(() => elegirCampaniaActual(fallbackCampanias)!.id);

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
  const campaniasBase = useMemo(() => asegurarCampaniaDeHoy(
    d.campaniasOperativas?.length ? d.campaniasOperativas : fallbackCampanias,
    fallbackCampanias,
  ), [d.campaniasOperativas, fallbackCampanias]);
  const campaniasOperativas = useMemo(() => completarCampaniasDesdeFechas(campaniasBase, [
    ...d.pariciones.map(x => x.fecha),
    ...d.lluvias.map(x => x.fecha),
    ...d.mortandad.map(x => x.fecha),
    ...d.pastoreo.flatMap(x => [x.fecha, x.fechaSalida]),
    ...d.pastoreoCiclos.flatMap(x => [x.fechaIngreso, x.fechaControl, x.fechaEncierre]),
    ...d.compras.map(x => x.fecha),
    ...d.ventas.map(x => x.fecha),
    ...d.ndvi.map(x => x.fecha),
    ...d.corrales.map(x => x.fechaEncierre),
  ]), [campaniasBase, d]);

  // Al llegar la respuesta de Supabase reemplazamos el ID fallback por el row
  // real. Una selección histórica válida se conserva incluso tras refresh.
  useEffect(() => {
    setCampaniaId(prev => campaniasOperativas.some(c => c.id === prev)
      ? prev
      : (elegirCampaniaActual(campaniasOperativas)?.id ?? campaniasOperativas[0]!.id));
  }, [campaniasOperativas]);

  const campaniaSeleccionada = campaniasOperativas.find(c => c.id === campaniaId)
    ?? elegirCampaniaActual(campaniasOperativas)
    ?? fallbackCampanias[0]!;
  const reproductivaSeleccionada = reproductivaParaOperativa(
    campaniaSeleccionada,
    d.campaniasReproductivas ?? [],
  );

  // Todos los módulos reciben data ya acotada. Sus filtros internos (campo,
  // categoría, 7d/30d, etc.) son refinamientos dentro de esta campaña.
  const scoped = useMemo(() => {
    const paricionesHasta = finReproductivo(campaniaSeleccionada);
    const pariciones = d.pariciones.filter(p =>
      p.fecha >= campaniaSeleccionada.fechaInicio && p.fecha <= paricionesHasta);
    const tactos = d.tactos.filter(t => t.campaniaId === reproductivaSeleccionada.id);
    return {
      pariciones,
      lluvias: d.lluvias.filter(x => enCampania(x.fecha, campaniaSeleccionada)),
      mortandad: d.mortandad.filter(x => enCampania(x.fecha, campaniaSeleccionada)),
      pastoreo: d.pastoreo.filter(x => solapaCampania(x.fecha, x.fechaSalida, campaniaSeleccionada)),
      pastoreoCiclos: d.pastoreoCiclos.filter(x => {
        const fechas = [x.fechaIngreso, x.fechaControl, x.fechaEncierre].filter((f): f is string => Boolean(f)).sort();
        return solapaCampania(fechas[0], fechas[fechas.length - 1], campaniaSeleccionada);
      }),
      resumenServicio: d.resumenServicio.filter(x => x.servicioAnio === reproductivaSeleccionada.servicioAnio),
      compras: d.compras.filter(x => enCampania(x.fecha, campaniaSeleccionada)),
      ventas: d.ventas.filter(x => enCampania(x.fecha, campaniaSeleccionada)),
      ndvi: d.ndvi.filter(x => enCampania(x.fecha, campaniaSeleccionada)),
      tactos,
      corrales: d.corrales.filter(x => enCampania(x.fechaEncierre, campaniaSeleccionada)),
    };
  }, [campaniaSeleccionada, d, reproductivaSeleccionada.id, reproductivaSeleccionada.servicioAnio]);
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

      {/* Selector global de tenant. Solo aparece para super-administradores y
          nunca ofrece una vista "Todos", para impedir KPIs mezclados. */}
      {showAdmin && view === 'modules' && (
        <ClienteScopeSelector
          clientes={clientesDisponibles.map(cliente => ({ id: cliente.id, nombre: cliente.nombre }))}
          clienteId={clienteSeleccionadoId}
          loading={clientesLoading}
          error={clientesError}
          onChange={cambiarCliente}
          onRetry={() => setClientesNonce(n => n + 1)}
        />
      )}

      {/* Tabs por módulo — solo en la vista de operaciones (la de billing
          es una página independiente sin tabs). */}
      {view === 'modules' && (
        <>
          <ModuleTabs
            active={modulo}
            onChange={setModulo}
          />
          <CampaniaOperativaBar
            campanias={campaniasOperativas}
            seleccionada={campaniaSeleccionada}
            onChange={setCampaniaId}
          />
        </>
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
            key={campaniaSeleccionada.id}
            pariciones={scoped.pariciones}
            campos={d.campos}
            resumenServicio={scoped.resumenServicio}
            tactos={scoped.tactos}
            campaniasReproductivas={[reproductivaSeleccionada]}
          />
        )}
        {view === 'modules' && data && modulo === 'lluvias' && (
          <LluviasPage key={campaniaSeleccionada.id} lluvias={scoped.lluvias} campos={d.campos} />
        )}
        {view === 'modules' && data && modulo === 'mortandad' && (
          <MortandadPage key={campaniaSeleccionada.id} mortandad={scoped.mortandad} campos={d.campos} />
        )}
        {view === 'modules' && data && modulo === 'pastoreo' && (
          // PastoreoModule maneja internamente los 3 sub-tabs:
          //   Pastoreo (vista actual) · Entradas · Cierre Corrales.
          // Antes Corrales era tab top-level — se movió adentro porque
          // conceptualmente es parte del ciclo de pastoreo (la última etapa
          // antes de la venta).
          <PastoreoModule
            key={campaniaSeleccionada.id}
            pastoreo={scoped.pastoreo}
            pastoreoCiclos={scoped.pastoreoCiclos}
            mortandad={scoped.mortandad}
            campos={d.campos}
            circuitos={d.circuitos}
            corrales={scoped.corrales}
          />
        )}
        {view === 'modules' && data && modulo === 'compras' && (
          // Compras = entradas de hacienda al sistema (proveedores).
          <ComprasPage key={campaniaSeleccionada.id} compras={scoped.compras} campos={d.campos} />
        )}
        {view === 'modules' && data && modulo === 'ventas' && (
          <VentasPage key={campaniaSeleccionada.id} ventas={scoped.ventas} campos={d.campos} />
        )}
        {view === 'modules' && data && modulo === 'prenez' && (
          // Tactos vienen de Supabase (tabla `tactos`, migration 0012).
          // RLS por cliente_id garantiza que cada tenant vea solo los
          // suyos. Si la tabla no existe todavía, fetchTactos devuelve
          // [] y PrenezPage muestra su empty state.
          <PrenezPage key={campaniaSeleccionada.id} tactos={scoped.tactos} />
        )}
        {view === 'modules' && data && modulo === 'ndvi' && (
          // NDVI/Materia Seca — data real desde Supabase tabla ndvi_pasturas.
          // Si la migración 0009 todavía no se aplicó, viene array vacío y
          // la página muestra el empty state.
          <NdviPage key={campaniaSeleccionada.id} mediciones={scoped.ndvi} campos={d.campos.map(c => c.nombre)} />
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

function adminScopeStorageKey(email: string | undefined | null): string {
  return `asfion:admin-cliente:${(email ?? 'sin-email').toLowerCase().trim()}`;
}

/** Conserva el módulo actual y deja el tenant visible/compartible en la URL. */
function writeClienteToUrl(clienteId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('cliente', clienteId);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
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
