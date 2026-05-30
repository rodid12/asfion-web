import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Campo, Paricion, SyncState } from '@/data/types';

interface Props {
  data: Paricion[];
  campos: Campo[];
  pageSize?: number;
}

const SYNC_COPY: Record<SyncState, { label: string; cls: string }> = {
  synced:  { label: 'OK',        cls: 'bg-asfion-lime/20 text-asfion-dark' },
  pending: { label: 'PENDIENTE', cls: 'bg-asfion-amber/20 text-asfion-amber' },
  syncing: { label: 'SUBIENDO',  cls: 'bg-asfion-muted/20 text-asfion-muted' },
  failed:  { label: 'FALLÓ',     cls: 'bg-asfion-terracota/20 text-asfion-terracota' },
};

export function ParicionesTable({ data, campos, pageSize = 20 }: Props) {
  const [page, setPage] = useState(0);
  const campoNom = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;

  const pages = Math.max(1, Math.ceil(data.length / pageSize));
  const slice = data.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-asfion-muted border-b border-asfion-borderSoft">
            <th className="py-3 px-2 font-semibold">Fecha</th>
            <th className="py-3 px-2 font-semibold">Campo</th>
            <th className="py-3 px-2 font-semibold">Grupo</th>
            <th className="py-3 px-2 font-semibold">Evento</th>
            <th className="py-3 px-2 font-semibold">Sexo</th>
            <th className="py-3 px-2 font-semibold">Caravana</th>
            <th className="py-3 px-2 font-semibold">Sync</th>
          </tr>
        </thead>
        <tbody>
          {slice.map(p => (
            <tr key={p.id} className="border-b border-asfion-borderSoft/50 hover:bg-asfion-bg/60 transition">
              <td className="py-3 px-2 tabular-nums text-asfion-dark">{p.fecha}</td>
              <td className="py-3 px-2 font-semibold text-asfion-dark">{campoNom(p.campoId)}</td>
              <td className="py-3 px-2 text-asfion-muted">{p.vacasGrupo}</td>
              <td className="py-3 px-2">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-semibold',
                    p.evento === 'Nacimiento' ? 'bg-asfion-dark text-white' :
                    p.evento === 'Retacto'    ? 'bg-asfion-lime/30 text-asfion-dark' :
                    p.evento === 'Muerte'     ? 'bg-asfion-terracota/20 text-asfion-terracota' :
                                                'bg-asfion-danger/20 text-asfion-danger',
                  )}
                >
                  {p.evento}
                </span>
              </td>
              <td className="py-3 px-2 text-asfion-muted">{p.sexo ?? '—'}</td>
              <td className="py-3 px-2 text-asfion-muted">
                {p.caravanaColor || p.caravanaNumero
                  ? `${p.caravanaColor ?? '—'} ${p.caravanaNumero ?? ''}`.trim()
                  : '—'}
              </td>
              <td className="py-3 px-2">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', SYNC_COPY[p.syncState].cls)}>
                  {SYNC_COPY[p.syncState].label}
                </span>
              </td>
            </tr>
          ))}
          {slice.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-asfion-muted italic">
                No hay pariciones que matcheen los filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-asfion-muted">
            Mostrando {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} de {data.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-asfion-borderSoft text-asfion-dark font-semibold disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
              disabled={page === pages - 1}
              className="px-3 py-1.5 rounded-lg border border-asfion-borderSoft text-asfion-dark font-semibold disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
