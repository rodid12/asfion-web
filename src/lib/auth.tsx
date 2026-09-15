// Contexto de auth para el dashboard.
//
// Wrappea la app entera: muestra LoginPage si no hay sesión, o el children
// (Dashboard) si la hay. Persistencia automática del SDK de Supabase via
// localStorage — el usuario no se reloguea entre reloads.
//
// Acceso al usuario actual desde cualquier componente con useAuth().

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  accessError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [candidateSession, setCandidateSession] = useState<Session | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    // Restore session inicial
    supabase.auth.getSession().then(({ data }) => setCandidateSession(data.session));

    // Reaccionar a login/logout en cualquier tab
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setCandidateSession(sess);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  // Google autentica la identidad, pero la autorización sigue estando en la
  // tabla `usuarios`. No exponemos el Dashboard hasta comprobar que el email
  // pertenece a un tenant; una cuenta Google ajena queda deslogueada.
  useEffect(() => {
    if (candidateSession === undefined) return;
    let cancelled = false;

    const validate = async () => {
      setLoading(true);
      if (!candidateSession?.user.email) {
        if (!cancelled) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      const email = candidateSession.user.email.trim().toLowerCase();
      const { data, error } = await supabase
        .from('usuarios')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setSession(null);
        setAccessError(`La cuenta ${email} no está autorizada para usar ASFION.`);
        setLoading(false);
        await supabase.auth.signOut();
        return;
      }

      setAccessError(null);
      setSession(candidateSession);
      setLoading(false);
    };

    void validate();
    return () => { cancelled = true; };
  }, [candidateSession]);

  const signIn = async (email: string, password: string) => {
    setAccessError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    setAccessError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    loading,
    accessError,
    signIn,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth: falta <AuthProvider>');
  return ctx;
}
