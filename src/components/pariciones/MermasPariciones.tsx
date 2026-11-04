import { useMemo } from 'react';
import { Card } from '@/components/Card';
import { MiniKpi } from '@/components/MiniKpi';
import { formatNumber, formatPercent } from '@/lib/utils';
import type { Paricion } from '@/data/types';

interface Props {
  data: Paricion[];
  stockBase: number;
}

const norm = (value?: string | null) => (value ?? '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

/**
 * Desglose reproductivo solicitado por Ganaderas. Cada indicador usa IDs
 * únicos. Ganaderas confirmó que cada orejano se registra en dos filas, por
 * lo que el indicador aplica el criterio operativo registros / 2.
 */
export function MermasPariciones({ data, stockBase }: Props) {
  const values = useMemo(() => {
    const retacto = new Set<string>();
    const nacidoMuerto = new Set<string>();
    const aborto = new Set<string>();
    const muerteSenalado = new Set<string>();
    const orejano = new Set<string>();

    data.forEach(row => {
      const evento = norm(row.evento);
      const causa = norm(row.causaTipo);
      const sexo = norm(row.sexo);
      if (evento === 'RETACTO') retacto.add(row.id);
      if (sexo !== 'OREJANO' && (evento === 'NACIDO MUERTO' || causa === 'NACIDO MUERTO')) {
        nacidoMuerto.add(row.id);
      }
      if (evento === 'ABORTO') aborto.add(row.id);
      if (evento === 'MUERTE' && causa === 'MUERTE SENALADO') muerteSenalado.add(row.id);
      if (sexo === 'OREJANO') orejano.add(row.id);
    });

    return {
      retacto: retacto.size,
      nacidoMuerto: nacidoMuerto.size,
      aborto: aborto.size,
      muerteSenalado: muerteSenalado.size,
      orejano: Math.floor(orejano.size / 2),
    };
  }, [data]);

  return (
    <Card
      title="Mermas"
      subtitle={`Porcentajes sobre Stock Base (${formatNumber(stockBase)}); Retacto se mantiene como cantidad`}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MiniKpi label="Retacto" value={formatNumber(values.retacto)} accent="navy" />
        <MiniKpi label="% Nacido muerto" value={stockBase ? formatPercent(values.nacidoMuerto / stockBase) : '—'} accent="danger" />
        <MiniKpi label="% Aborto" value={stockBase ? formatPercent(values.aborto / stockBase) : '—'} accent="terracota" />
        <MiniKpi label="% Muerte señalado" value={stockBase ? formatPercent(values.muerteSenalado / stockBase) : '—'} accent="terracota" />
        <MiniKpi label="% Orejano (÷2)" value={stockBase ? formatPercent(values.orejano / stockBase) : '—'} accent="navy" />
      </div>
      <p className="mt-3 text-xs text-asfion-muted">
        Orejano se calcula como registros cargados ÷ 2, según el criterio operativo confirmado.
      </p>
    </Card>
  );
}
