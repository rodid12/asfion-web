import React from 'react';
import { Building2Icon, ChevronDownIcon } from 'lucide-react';

export interface ClienteScopeOption {
  id: string;
  nombre: string;
}

interface Props {
  clientes: ClienteScopeOption[];
  clienteId: string | null;
  loading: boolean;
  error?: string | null;
  onChange: (clienteId: string) => void;
  onRetry?: () => void;
}

/**
 * Barra de contexto exclusiva para super-administradores.
 *
 * No es un filtro visual más: define el tenant de TODAS las consultas del
 * dashboard. Por eso nunca ofrece "Todos" — mezclar clientes en KPIs sería
 * ambiguo y podría exponer datos cruzados por accidente.
 */
export function ClienteScopeSelector({
  clientes,
  clienteId,
  loading,
  error,
  onChange,
  onRetry,
}: Props) {
  return (
    <div className="border-b border-asfion-orange/25 bg-asfion-orangeSoft/35">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-asfion-navyDeep">
          <span className="w-7 h-7 rounded-lg bg-asfion-orange/15 grid place-items-center">
            <Building2Icon size={15} className="text-asfion-orange" />
          </span>
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-wider font-bold text-asfion-muted">
              Vista administrativa
            </p>
            <p className="text-xs font-semibold">Viendo solamente</p>
          </div>
        </div>

        <div className="relative min-w-[220px] max-w-sm flex-1 sm:flex-none">
          <select
            value={clienteId ?? ''}
            onChange={event => onChange(event.target.value)}
            disabled={loading || clientes.length === 0}
            aria-label="Cliente visualizado"
            className="w-full appearance-none rounded-lg border border-asfion-orange/35 bg-white px-3 py-2 pr-9 text-sm font-bold text-asfion-navyDeep shadow-sm outline-none transition focus:border-asfion-orange focus:ring-2 focus:ring-asfion-orange/20 disabled:cursor-wait disabled:opacity-60"
          >
            {!clienteId && (
              <option value="">{loading ? 'Cargando clientes…' : 'Seleccionar cliente'}</option>
            )}
            {clientes.map(cliente => (
              <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
            ))}
          </select>
          <ChevronDownIcon
            size={15}
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-asfion-muted"
          />
        </div>

        <p className="text-[11px] text-asfion-muted">
          Los módulos y las métricas quedan aislados por cliente.
        </p>

        {error && (
          <div className="basis-full text-xs text-asfion-danger flex items-center gap-2">
            <span>{error}</span>
            {onRetry && (
              <button type="button" onClick={onRetry} className="font-bold underline">
                Reintentar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
