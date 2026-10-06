import { supabase } from '@/lib/supabase';

export const DEFAULT_CLIENT_MODULES = [
  'pariciones',
  'lluvias',
  'mortandad',
  'pastoreo',
  'compras',
  'ventas',
] as const;

const VALID_MODULES = new Set<string>([
  ...DEFAULT_CLIENT_MODULES,
  'prenez',
  'ndvi',
]);

/**
 * Devuelve los módulos del tenant del usuario actual. No recibe cliente_id:
 * la policy RLS de `clientes` expone únicamente el row que corresponde a la
 * sesión, evitando que un usuario normal pueda consultar otra configuración.
 */
export async function fetchOwnClientModules(): Promise<string[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('modulos_habilitados')
    .maybeSingle();

  if (error) throw new Error(`fetchOwnClientModules: ${error.message}`);

  const raw = Array.isArray(data?.modulos_habilitados)
    ? data.modulos_habilitados
    : [];

  return raw.filter((module): module is string =>
    typeof module === 'string' && VALID_MODULES.has(module));
}
