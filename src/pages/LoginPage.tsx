// Pantalla de login del dashboard.
//
// Misma identidad visual que el deck/app: fondo oscuro premium, acento lime,
// tipografía Inter. El email/password van directo a supabase.auth.
// La app entera está envuelta en <AuthProvider>, que decide qué renderear:
// si no hay sesión, muestra esta pantalla; si la hay, muestra el Dashboard.

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';

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
    <div className="min-h-screen bg-asfion-deep text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-4 h-4 rounded-full bg-asfion-lime" />
            <h1 className="text-3xl font-extrabold tracking-wide">ASFION</h1>
          </div>
          <p className="text-sm text-asfion-lime italic">
            Del campo al tablero, sin fricción.
          </p>
        </div>

        {/* Card de login */}
        <form
          onSubmit={onSubmit}
          className="bg-white text-asfion-deep rounded-2xl p-8 shadow-card space-y-5"
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
              className="w-full px-3 py-2.5 rounded-lg border border-asfion-borderSoft focus:outline-none focus:ring-2 focus:ring-asfion-lime focus:border-transparent text-base"
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
              className="w-full px-3 py-2.5 rounded-lg border border-asfion-borderSoft focus:outline-none focus:ring-2 focus:ring-asfion-lime focus:border-transparent text-base"
            />
          </div>

          {error && (
            <div className="text-sm text-asfion-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full px-4 py-3 rounded-lg bg-asfion-dark text-white font-bold hover:bg-asfion-deep transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Ingresando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-asfion-lime/60 mt-6">
          Dashboard v0.1 · Solo usuarios autorizados
        </p>
      </div>
    </div>
  );
}
