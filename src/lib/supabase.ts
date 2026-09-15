// Cliente único de Supabase para el dashboard.
//
// Lee credenciales del .env.local (Vite expone solo variables con prefijo
// VITE_). Si faltan, devolvemos un cliente "rota-a-propósito" — los
// componentes que lo usen van a tirar errores manejables, en vez de
// hacer un throw al import que deja la página en blanco.
//
// La sesión persiste en localStorage (default del SDK), así el usuario no
// tiene que loguearse cada reload.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const envOk = Boolean(url && anonKey);

// Alcance explícito para consultas multi-cliente del dashboard.
//
// El valor viaja dentro del header estándar `x-client-info`, que Supabase ya
// permite. La RLS valida este mismo valor antes de habilitar a un super-admin
// a leer o administrar filas de un tenant distinto al de su JWT. Una APK vieja
// no envía `asfion-tenant=...`, por lo que conserva el aislamiento de su tenant.
let adminClienteRequestScope: string | null = null;

export function setAdminClienteRequestScope(clienteId?: string | null): void {
  if (clienteId && !/^[a-z0-9-]+$/.test(clienteId)) {
    throw new Error('Alcance de cliente inválido');
  }
  adminClienteRequestScope = clienteId || null;
}

const scopedFetch: typeof fetch = (input, init) => {
  const inheritedHeaders = input instanceof Request ? input.headers : undefined;
  const headers = new Headers(init?.headers ?? inheritedHeaders);
  const currentClientInfo = headers.get('x-client-info') ?? 'asfion-web';
  const cleanClientInfo = currentClientInfo
    .replace(/;?asfion-tenant=[a-z0-9-]+/g, '')
    .replace(/;+$/g, '');

  headers.set(
    'x-client-info',
    adminClienteRequestScope
      ? `${cleanClientInfo};asfion-tenant=${adminClienteRequestScope}`
      : cleanClientInfo,
  );

  return fetch(input, { ...init, headers });
};

if (!envOk) {
  // Log en consola (visible en DevTools) pero NO tiramos — sino la página
  // se queda en blanco y el usuario no entiende qué pasó. El árbol React
  // tiene un guard que muestra el mensaje en pantalla.
  // eslint-disable-next-line no-console
  console.error(
    '[ASFION dashboard] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY ' +
    'en .env.local — copiá .env.local.example y completá los valores.',
  );
}

// Si faltan vars, usamos placeholders que hacen que cualquier llamada falle
// con error claro pero no rompe el bundle al cargar.
export const supabase = createClient(
  url ?? 'https://missing.supabase.co',
  anonKey ?? 'missing',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Necesario para consumir el callback de Google OAuth al volver al
      // dashboard. El login email/contraseña sigue funcionando igual.
      detectSessionInUrl: true,
    },
    global: {
      fetch: scopedFetch,
    },
  },
);
