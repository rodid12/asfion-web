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
