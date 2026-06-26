// Routing minimal del dashboard.
//
// El dashboard es single-page por diseño — no usamos react-router porque
// es overkill para el caso. Solo necesitamos que la URL refleje qué tab
// está activa, así:
//   - El operario puede refrescar y volver a Mortandad sin perder el lugar
//   - Los links a vistas específicas son shareables ("mandame el de
//     compras", pegás https://.../compras y va directo)
//   - El back/forward del browser navega entre tabs
//
// Mapping path → vista:
//
//   /             → módulos, default 'pariciones'
//   /pariciones   → módulos, Pariciones
//   /lluvias      → módulos, Lluvias
//   /mortandad    → módulos, Mortandad
//   /pastoreo     → módulos, Pastoreo (con sus sub-tabs)
//   /ndvi         → módulos, NDVI / MS
//   /compras      → módulos, Compras
//   /ventas       → módulos, Ventas
//   /prenez       → módulos, Preñez
//   /billing      → vista de cobranzas (solo super-admin)
//
// Cualquier otro path desconocido → 'pariciones' como fallback.

import type { ModuleKey } from '@/components/ModuleTabs';

export type RouteView = 'modules' | 'billing' | 'admin';

export interface ParsedRoute {
  view: RouteView;
  modulo: ModuleKey;
}

const MODULE_PATHS: Record<ModuleKey, string> = {
  pariciones: '/pariciones',
  lluvias:    '/lluvias',
  mortandad:  '/mortandad',
  pastoreo:   '/pastoreo',
  ndvi:       '/ndvi',
  compras:    '/compras',
  ventas:     '/ventas',
  prenez:     '/prenez',
};

const PATH_TO_MODULE: Record<string, ModuleKey> = {
  '/':            'pariciones',
  '/pariciones':  'pariciones',
  '/lluvias':     'lluvias',
  '/mortandad':   'mortandad',
  '/pastoreo':    'pastoreo',
  '/ndvi':        'ndvi',
  '/compras':     'compras',
  '/ventas':      'ventas',
  '/prenez':      'prenez',
};

/** Lee la URL actual del browser y devuelve la vista + módulo activo. */
export function parseCurrentPath(): ParsedRoute {
  if (typeof window === 'undefined') return { view: 'modules', modulo: 'pariciones' };
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/billing') return { view: 'billing', modulo: 'pariciones' };
  if (path === '/admin')   return { view: 'admin',   modulo: 'pariciones' };
  const modulo = PATH_TO_MODULE[path] ?? 'pariciones';
  return { view: 'modules', modulo };
}

/** Devuelve el path para una vista/módulo dado. */
export function pathFor(view: RouteView, modulo: ModuleKey): string {
  if (view === 'billing') return '/billing';
  if (view === 'admin')   return '/admin';
  return MODULE_PATHS[modulo] ?? '/pariciones';
}

/** Actualiza la URL del browser sin recargar la página. Solo si el path
 *  nuevo es distinto al actual (evita pushState innecesarios). */
export function pushPath(view: RouteView, modulo: ModuleKey): void {
  if (typeof window === 'undefined') return;
  const next = pathFor(view, modulo);
  const current = window.location.pathname.replace(/\/+$/, '') || '/';
  if (current === next) return;
  // Mantenemos el search + hash si hay (ej. ?campo=X en algún futuro).
  window.history.pushState({}, '', next + window.location.search + window.location.hash);
}
