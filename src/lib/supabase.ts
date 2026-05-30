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
      detectSessionInUrl: false,
    },
  },
);
