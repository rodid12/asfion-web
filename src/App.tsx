// Punto de entrada. Estructura:
//   <AuthProvider> mantiene la sesión de Supabase en memoria.
//   <Gate> decide qué renderear:
//     - sin env vars: pantalla de setup (no podemos hablar con Supabase)
//     - mientras carga la sesión inicial: splash mínimo
//     - sin sesión: <LoginPage>
//     - con sesión: <Dashboard>

import React from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { envOk } from '@/lib/supabase';
import { Dashboard } from '@/pages/Dashboard';
import { LoginPage } from '@/pages/LoginPage';

function MissingEnv() {
  return (
    <div className="min-h-screen bg-asfion-navyDeep text-white flex items-center justify-center px-4">
      <div className="max-w-lg bg-white text-asfion-navyDeep rounded-2xl p-8 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-asfion-orange" />
          <h1 className="text-lg font-extrabold">ASFION · Setup pendiente</h1>
        </div>
        <p className="text-sm text-asfion-muted mb-4">
          No se encontraron las credenciales de Supabase. Para arrancar el
          dashboard tenés que crear el archivo <code className="bg-asfion-bg px-1.5 py-0.5 rounded text-asfion-navyDeep font-mono text-xs">.env.local</code> en
          la raíz de <code className="bg-asfion-bg px-1.5 py-0.5 rounded text-asfion-navyDeep font-mono text-xs">asfion-web/</code> con:
        </p>
        <pre className="bg-asfion-navyDeep text-asfion-orange text-xs rounded-lg p-3 overflow-x-auto">
{`VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
        </pre>
        <p className="text-xs text-asfion-muted mt-4">
          Los valores están en Supabase Dashboard → Settings → API.
          Después reiniciá <code className="bg-asfion-bg px-1.5 py-0.5 rounded font-mono">npm run dev</code>.
        </p>
      </div>
    </div>
  );
}

function Gate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-asfion-navyDeep flex items-center justify-center">
        <div className="text-asfion-orange/70 text-sm">Cargando…</div>
      </div>
    );
  }

  return session ? <Dashboard /> : <LoginPage />;
}

export default function App() {
  if (!envOk) return <MissingEnv />;

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
