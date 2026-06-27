// =============================================================================
// campoMap.ts — Helper para resolver campoId → nombre sin .find() en hot paths
// =============================================================================
//
// Audit del 27-jun-2026 (item #11): el patrón `campos.find(c => c.id === id)`
// dentro de loops de render o de export CSV vuelve O(N×M) — con 3.500 rows ×
// 20 campos = 70k comparaciones por click de export. Centralizar en un Map
// precomputado convierte cada lookup en O(1).
//
// Uso:
//   import { useCampoNombre } from '@/lib/campoMap';
//   const campoNombre = useCampoNombre(campos);
//   // ...
//   {filtrados.map(r => <td>{campoNombre(r.campoId)}</td>)}

import { useMemo } from 'react';
import type { Campo } from '@/data/types';

/**
 * Devuelve una función `(id) => nombre` con Map precomputado.
 * Si el id no existe en la lista, devuelve el id como fallback (consistente
 * con el patrón viejo `?? id`).
 */
export function useCampoNombre(campos: Campo[]): (id: string | undefined | null) => string {
  return useMemo(() => {
    const m = new Map(campos.map(c => [c.id, c.nombre]));
    return (id) => (id != null && m.get(id)) || (id ?? '—');
  }, [campos]);
}

/**
 * Versión non-hook por si se necesita fuera de un componente React (ej.
 * dentro de un callback de export). Crea el Map al vuelo — usar dentro de
 * useCallback si el campos array cambia poco.
 */
export function campoNombreFn(campos: Campo[]): (id: string | undefined | null) => string {
  const m = new Map(campos.map(c => [c.id, c.nombre]));
  return (id) => (id != null && m.get(id)) || (id ?? '—');
}
