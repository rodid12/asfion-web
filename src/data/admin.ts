// Operaciones del panel de administración (super-admin only).
//
// Estas queries usan el cliente Supabase normal (con el JWT del super-admin
// logueado). Las policies de migration 0005 + 0015 garantizan que solo los
// emails listados en is_super_admin() pueden ejecutarlas.
//
// Si un usuario regular llamara a estas funciones, RLS bloquearía la
// operación con `new row violates row-level security policy`.

import { supabase } from '@/lib/supabase';

// =============================================================================
// URL canónica para magic links — evita que invitaciones se manden a deploys
// de preview en Vercel (`*-git-*.vercel.app`). Si un atacante consigue un
// dominio similar al de preview, podría redirigir tokens válidos a su clone.
//
// Resolución:
//   1. VITE_APP_URL (env var de prod, ej "https://dashboard.asfion.com.ar")
//   2. window.location.origin (fallback dev/local)
// =============================================================================
function canonicalAppUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_APP_URL as string | undefined;
  return envUrl?.trim() || window.location.origin;
}

// =============================================================================
// Tipos crudos
// =============================================================================

export interface ClienteAdminRow {
  id: string;
  nombre: string;
  tagline: string | null;
  modulos_habilitados: string[];
  subscription_status: string | null;
  period_end_date: string | null;
  created_at: string;
}

export interface CampoAdminRow {
  id: string;
  cliente_id: string;
  nombre: string;
  organizacion_id: string | null;
  stock_inicial_vacas: number | null;
}

// =============================================================================
// Clientes
// =============================================================================

/** Lista todos los clientes (super-admin only). */
export async function adminListClientes(): Promise<ClienteAdminRow[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, tagline, modulos_habilitados, subscription_status, period_end_date, created_at')
    .order('nombre');
  if (error) throw new Error(`adminListClientes: ${error.message}`);
  return (data ?? []) as ClienteAdminRow[];
}

export interface CreateClienteInput {
  id: string;                   // slug, ej "estancia-las-margaritas"
  nombre: string;
  tagline?: string;
  modulosHabilitados: string[]; // ['pariciones', 'lluvias', ...]
  /** Catálogos por módulo. Si se omite, se inicializa vacío y la app móvil
   *  usa el fallback compile-time hasta que el admin los configure. */
  catalogos?: Record<string, any>;
}

/** Crea un cliente nuevo en la tabla `clientes`. Hace upsert por id. */
export async function adminCreateCliente(input: CreateClienteInput): Promise<void> {
  // Validación mínima del id como slug — solo lowercase, números, guiones.
  if (!/^[a-z0-9-]+$/.test(input.id)) {
    throw new Error('ID inválido: usar solo minúsculas, números y guiones (ej. "estancia-las-margaritas")');
  }
  if (!input.nombre.trim()) {
    throw new Error('El nombre del cliente es obligatorio');
  }
  if (input.modulosHabilitados.length === 0) {
    throw new Error('Tenés que habilitar al menos un módulo');
  }

  const { error } = await supabase.from('clientes').insert({
    id: input.id,
    nombre: input.nombre.trim(),
    tagline: input.tagline?.trim() || null,
    modulos_habilitados: input.modulosHabilitados,
    catalogos: input.catalogos ?? {},
    subscription_status: 'active',
  });
  if (error) {
    if (error.code === '23505') throw new Error(`Ya existe un cliente con id "${input.id}"`);
    throw new Error(`adminCreateCliente: ${error.message}`);
  }
}

export interface UpdateClienteInput {
  nombre?: string;
  tagline?: string | null;
  modulosHabilitados?: string[];
  catalogos?: Record<string, any>;
}

/** Edita un cliente existente. Solo cambia los campos pasados. */
export async function adminUpdateCliente(id: string, input: UpdateClienteInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: any = {};
  if (input.nombre !== undefined)              patch.nombre = input.nombre.trim();
  if (input.tagline !== undefined)             patch.tagline = input.tagline?.trim() || null;
  if (input.modulosHabilitados !== undefined)  patch.modulos_habilitados = input.modulosHabilitados;
  if (input.catalogos !== undefined)           patch.catalogos = input.catalogos;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from('clientes').update(patch).eq('id', id);
  if (error) throw new Error(`adminUpdateCliente: ${error.message}`);
}

// =============================================================================
// Campos
// =============================================================================

/** Lista TODOS los campos de un cliente (super-admin only). */
export async function adminListCampos(clienteId: string): Promise<CampoAdminRow[]> {
  const { data, error } = await supabase
    .from('campos')
    .select('id, cliente_id, nombre, organizacion_id, stock_inicial_vacas')
    .eq('cliente_id', clienteId)
    .order('nombre');
  if (error) throw new Error(`adminListCampos: ${error.message}`);
  return (data ?? []) as CampoAdminRow[];
}

export interface CreateCampoInput {
  id: string;
  clienteId: string;
  nombre: string;
  stockInicialVacas?: number;
  organizacionId?: string;
}

export async function adminCreateCampo(input: CreateCampoInput): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(input.id)) {
    throw new Error('ID de campo inválido: usar solo minúsculas, números y guiones (ej. "campo-carolina")');
  }
  if (!input.nombre.trim()) {
    throw new Error('El nombre del campo es obligatorio');
  }
  const { error } = await supabase.from('campos').insert({
    id: input.id,
    cliente_id: input.clienteId,
    nombre: input.nombre.trim(),
    organizacion_id: input.organizacionId ?? `org-${input.clienteId}`,
    stock_inicial_vacas: input.stockInicialVacas ?? null,
  });
  if (error) {
    if (error.code === '23505') throw new Error(`Ya existe un campo con id "${input.id}"`);
    throw new Error(`adminCreateCampo: ${error.message}`);
  }
}

/** Edita el stock_inicial_vacas o el nombre de un campo. */
export async function adminUpdateCampo(id: string, patch: { nombre?: string; stockInicialVacas?: number | null }): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbPatch: any = {};
  if (patch.nombre !== undefined) dbPatch.nombre = patch.nombre.trim();
  if (patch.stockInicialVacas !== undefined) dbPatch.stock_inicial_vacas = patch.stockInicialVacas;
  if (Object.keys(dbPatch).length === 0) return;
  const { error } = await supabase.from('campos').update(dbPatch).eq('id', id);
  if (error) throw new Error(`adminUpdateCampo: ${error.message}`);
}

/** Borra un campo. Falla si tiene eventos asociados (FK RESTRICT). */
export async function adminDeleteCampo(id: string): Promise<void> {
  const { error } = await supabase.from('campos').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      throw new Error('No se puede borrar: hay eventos (pariciones / mortandad / etc) asociados a este campo. Borrá primero los eventos.');
    }
    throw new Error(`adminDeleteCampo: ${error.message}`);
  }
}

// =============================================================================
// Usuarios
// =============================================================================

export type RolUsuario = 'administrador' | 'moderador' | 'operario';

export interface UsuarioAdminRow {
  email: string;
  cliente_id: string;
  nombre: string | null;
  apellido: string | null;
  rol: RolUsuario;
  campo_asignado_id: string | null;
  created_at: string;
}

/** Lista los usuarios de un cliente (super-admin only). */
export async function adminListUsuarios(clienteId: string): Promise<UsuarioAdminRow[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('email, cliente_id, nombre, apellido, rol, campo_asignado_id, created_at')
    .eq('cliente_id', clienteId)
    .order('email');
  if (error) throw new Error(`adminListUsuarios: ${error.message}`);
  return (data ?? []) as UsuarioAdminRow[];
}

export interface InviteUsuarioInput {
  email: string;
  clienteId: string;
  rol: RolUsuario;
  nombre?: string;
  apellido?: string;
  /** Campo principal que se preselecciona en los forms de la app móvil.
   *  Si es null, el operario tiene que elegir manualmente cada vez. */
  campoAsignadoId?: string | null;
  /** URL a la que el magic link redirige tras clickear (debería ser el
   *  dominio del dashboard o de la app web, no de Vercel preview). */
  redirectTo?: string;
}

/**
 * Invita un usuario nuevo:
 *   1. Manda magic link a su email (signInWithOtp con shouldCreateUser).
 *      Esto crea el user en `auth.users` si no existe.
 *   2. Inserta el row en `usuarios` con cliente_id, rol y campo asignado.
 *
 * Importante: signInWithOtp NO cambia la sesión actual del super-admin.
 * El nuevo user solo entra cuando clickea el link en su email.
 *
 * Si el email YA existe en `usuarios` (mismo cliente o distinto), el
 * INSERT falla con duplicate key — manejamos el error para mostrar
 * mensaje claro.
 */
export async function adminInviteUsuario(input: InviteUsuarioInput): Promise<void> {
  // Validación básica de email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error('Email inválido');
  }
  const emailNorm = input.email.trim().toLowerCase();

  // PASO 1: insertar en tabla `usuarios` PRIMERO. Si esto falla (email
  // duplicado, cliente_id inválido), no mandamos el magic link.
  const { error: insertError } = await supabase.from('usuarios').insert({
    email: emailNorm,
    cliente_id: input.clienteId,
    nombre: input.nombre?.trim() || null,
    apellido: input.apellido?.trim() || null,
    rol: input.rol,
    campo_asignado_id: input.campoAsignadoId ?? null,
  });
  if (insertError) {
    if (insertError.code === '23505') {
      throw new Error(`El email ${emailNorm} ya está registrado en otro cliente o este mismo.`);
    }
    throw new Error(`adminInviteUsuario: ${insertError.message}`);
  }

  // PASO 2: mandar magic link. Si esto falla (email no enviable, SMTP
  // no configurado), el row en `usuarios` queda — el super-admin puede
  // mandar la invitación manualmente desde Supabase Console o re-intentar.
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: emailNorm,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: input.redirectTo ?? canonicalAppUrl(),
    },
  });
  if (otpError) {
    // No tiramos error grande — el row se creó OK. Solo loguear.
    console.warn('[adminInviteUsuario] magic link no se envió:', otpError.message);
    throw new Error(
      `Usuario creado en la tabla, pero el link de invitación no se envió: ${otpError.message}. ` +
      `Verificá la config de SMTP de Supabase o mandá la invitación desde Authentication → Users.`,
    );
  }
}

export interface UpdateUsuarioInput {
  nombre?: string | null;
  apellido?: string | null;
  rol?: RolUsuario;
  campoAsignadoId?: string | null;
}

export async function adminUpdateUsuario(email: string, input: UpdateUsuarioInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: any = {};
  if (input.nombre !== undefined)          patch.nombre = input.nombre?.trim() || null;
  if (input.apellido !== undefined)        patch.apellido = input.apellido?.trim() || null;
  if (input.rol !== undefined)             patch.rol = input.rol;
  if (input.campoAsignadoId !== undefined) patch.campo_asignado_id = input.campoAsignadoId;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from('usuarios').update(patch).eq('email', email);
  if (error) throw new Error(`adminUpdateUsuario: ${error.message}`);
}

/**
 * Borra un usuario de la tabla `usuarios`. NOTA: NO borra el row de
 * `auth.users` (eso requiere service_role y no se puede hacer desde el
 * frontend). El user queda en auth pero sin cliente_id asociado — al
 * loguearse no va a poder entrar a ningún dashboard. Si querés hard
 * delete, hay que borrarlo desde Supabase Console.
 */
export async function adminDeleteUsuario(email: string): Promise<void> {
  const { error } = await supabase.from('usuarios').delete().eq('email', email);
  if (error) throw new Error(`adminDeleteUsuario: ${error.message}`);
}

/**
 * Re-envía el magic link a un usuario existente (útil si el primer link
 * caducó o se perdió en spam).
 */
export async function adminReenviarMagicLink(email: string, redirectTo?: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: false, // ya existe, solo mandar el link
      emailRedirectTo: redirectTo ?? canonicalAppUrl(),
    },
  });
  if (error) throw new Error(`adminReenviarMagicLink: ${error.message}`);
}
