import { useMemo } from 'react';
import { Card } from '@/components/Card';
import { MiniKpi } from '@/components/MiniKpi';
import { formatNumber } from '@/lib/utils';
import type { Paricion } from '@/data/types';

interface Props {
  data: Paricion[];
}

const norm = (value?: string | null) => (value ?? '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

/**
 * Desglose reproductivo solicitado por Ganaderas. Cada indicador usa IDs
 * únicos y conserva el registro real: Orejano no se divide globalmente porque
 * no existe una clave confiable para emparejar dos cargas sin caravana.
 */
export function MermasPariciones({ data }: Props) {
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
      if (evento === 'NACIDO MUERTO' || causa === 'NACIDO MUERTO') nacidoMuerto.add(row.id);
      if (evento === 'ABORTO') aborto.add(row.id);
      if (evento === 'MUERTE' && causa === 'MUERTE SENALADO') muerteSenalado.add(row.id);
      if (sexo === 'OREJANO') orejano.add(row.id);
    });

    return {
      retacto: retacto.size,
      nacidoMuerto: nacidoMuerto.size,
      aborto: aborto.size,
      muerteSenalado: muerteSenalado.size,
      orejano: orejano.size,
    };
  }, [data]);

  return (
    <Card
      title="Mermas"
      subtitle="Retacto, nacido muerto, aborto, muerte señalada y orejanos de la campaña seleccionada"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MiniKpi label="Retacto" value={formatNumber(values.retacto)} accent="navy" />
        <MiniKpi label="Nacido muerto" value={formatNumber(values.nacidoMuerto)} accent="danger" />
        <MiniKpi label="Aborto" value={formatNumber(values.aborto)} accent="terracota" />
        <MiniKpi label="Muerte señalado" value={formatNumber(values.muerteSenalado)} accent="terracota" />
        <MiniKpi label="Orejano (registros)" value={formatNumber(values.orejano)} accent="navy" />
      </div>
      <p className="mt-3 text-xs text-asfion-muted">
        Los orejanos se muestran como registros reales y no se dividen automáticamente.
      </p>
    </Card>
  );
}
