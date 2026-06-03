// EmptyModule — placeholder cuando una página de módulo no tiene datos.
//
// Antes vivía duplicado en las 5 páginas de módulo (Pariciones, Lluvias,
// Mortandad, Pastoreo, Compras) con la misma estructura visual y una
// pequeña diferencia (el participio cargadas/cargados según género del
// sustantivo). Lo centralizamos acá para que cualquier cambio de copy o
// estilo se haga en un solo lugar.

import React from 'react';

interface Props {
  /** Sustantivo plural del módulo — ej. "pariciones", "movimientos de pastoreo". */
  label: string;
  /**
   * Si el sustantivo es masculino (movimientos, etc.) pasar 'masc' para que
   * el participio quede "cargados". Default es 'fem' → "cargadas".
   */
  genero?: 'fem' | 'masc';
}

export function EmptyModule({ label, genero = 'fem' }: Props) {
  const participio = genero === 'masc' ? 'cargados' : 'cargadas';
  return (
    <div className="rounded-xl border border-asfion-borderSoft bg-white px-6 py-10 text-center">
      <p className="text-asfion-navy font-semibold">
        Todavía no hay {label} {participio}.
      </p>
      <p className="text-sm text-asfion-muted mt-1">
        En cuanto los operarios carguen eventos desde la app, los vas a ver acá.
      </p>
    </div>
  );
}
