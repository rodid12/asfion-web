// Pantalla de login del dashboard.
//
// Misma identidad visual que el deck/app: fondo oscuro premium (navyDeep),
// acento orange brand (#FF8409), tipografía Inter. El email/password van
// directo a supabase.auth.
// La app entera está envuelta en <AuthProvider>, que decide qué renderear:
// si no hay sesión, muestra esta pantalla; si la hay, muestra el Dashboard.

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // El AuthProvider va a re-renderear el árbol y mostrar el Dashboard.
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-asfion-navyDeep text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Branding — logo oficial centrado + tagline */}
        <div className="text-center mb-8">
          <Logo height={56} className="mx-auto mb-4" />
          <p className="text-sm text-asfion-orange italic">
            Del campo al tablero, sin fricción.
          </p>
        </div>

        {/* Card de login */}
        <form
          onSubmit={onSubmit}
          className="bg-white text-asfion-navyDeep rounded-2xl p-8 shadow-card space-y-5"
        >
          <div>
            <h2 className="text-xl font-extrabold">Acceso al tablero</h2>
            <p className="text-sm text-asfion-muted mt-1">
              Iniciá sesión con la misma cuenta que usás en la app.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-asfion-muted">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-asfion-borderSoft focus:outline-none focus:ring-2 focus:ring-asfion-orange focus:border-transparent text-base"
              placeholder="usuario@ejemplo.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-asfion-muted">
              Contraseña
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-asfion-borderSoft focus:outline-none focus:ring-2 focus:ring-asfion-orange focus:border-transparent text-base"
            />
          </div>

          {error && (
            <div className="text-sm text-asfion-danger bg-asfion-danger/10 border border-asfion-danger/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full px-4 py-3 rounded-lg bg-asfion-navy text-white font-bold hover:bg-asfion-navyDeep transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Ingresando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-asfion-orange/60 mt-6">
          Dashboard v0.1 · Solo usuarios autorizados
        </p>
      </div>
    </div>
  );
}
