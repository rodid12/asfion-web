// Página del módulo Mortandad.
//
// KPIs: total muertes, categoría top, causa top, campo top.
// Charts: por categoría, por causa, por campo, evolución mensual.

import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangleIcon, MapPinIcon, SkullIcon, TagIcon } from 'lucide-react';
import { Card } from '@/components/Card';
import { Kpi } from '@/components/Kpi';
import { MortandadMap } from '@/components/MortandadMap';
import {
  SimpleFilterBar,
  SIMPLE_FILTROS_DEFAULT,
  enPeriodo,
  añosEnData,
  type SimpleFiltros,
} from '@/components/SimpleFilterBar';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { PageHeader } from '@/components/PageHeader';
import { EmptyModule } from '@/components/EmptyModule';
import { formatNumber } from '@/lib/utils';
import { rowsToCsv, downloadCsv, csvFilename, type CsvColumn } from '@/lib/csv';
import type { Campo, Mortandad } from '@/data/types';

interface Props {
  mortandad: Mortandad[];
  campos: Campo[];
}

// Normaliza la causa de muerte para agrupar variantes que los operarios
// cargan a mano (abreviaciones, typos, mayúsculas/minúsculas). Sin esto
// el donut se infla con 30+ causas, muchas con 1-2 casos cada una, y
// pierde valor analítico.
//
// Reglas (todas case-insensitive):
//   "Neumo"           → "Neumonía"
//   "Tristeza/Anaplas" → "Tristeza"
//   "Desconose", "Desconocida", null, "" → "Sin identificar"
//   "Parto distocico" → "Distocia"
//   "Problema de parto" → "Distocia"
//
// Las causas concretas y bien escritas pasan tal cual.
// Exportada porque el componente MortandadMap también la usa para
// colorear los pins por causa de manera consistente con el donut.
export function normalizarCausa(causa: string | null | undefined): string {
  if (!causa) return 'Sin identificar';
  const c = causa.trim();
  // Strings basura (puntos solos, comas, texto muy corto sin letras) van
  // todas al bucket "Sin identificar" — no aportan info.
  if (!c || c.length < 3 || !/[a-záéíóúñ]/i.test(c)) return 'Sin identificar';
  const lower = c.toLowerCase();
  // Variantes de "sin info" → mismo bucket. Incluye typos comunes que
  // el operario carga sin tilde o trunca.
  if (
    ['sin identificar', 'sin especificar', 'desconose', 'desconocida',
     'desconocido', 'desconocid', 'no se sabe', 'no identificada',
     'no sabe', 's/d', 'nd'].includes(lower)
  ) {
    return 'Sin identificar';
  }
  // Neumonía / Neumo / Neumonía y X (la diarrea es secundaria → cuenta como neumonía)
  if (lower === 'neumo' || lower === 'neumonia' || lower === 'neumonía' || lower.startsWith('neumonía')) {
    return 'Neumonía';
  }
  // Tristeza (incluye variantes con Anaplas, garrapata, etc.)
  if (lower.startsWith('tristeza')) return 'Tristeza';
  // Distocia (problemas de parto)
  if (lower.includes('distocia') || lower.includes('distócico') || lower.includes('parto distoc') || lower === 'problema de parto') {
    return 'Distocia';
  }
  // Respiratorio (Problema respiratorio + "Dificultad respiratoria" + variantes)
  if (lower.includes('respiratori')) return 'Problema respiratorio';
  // Vieja/Viejo/Vejez → Vejez (animal viejo flaco que muere)
  if (lower === 'vieja' || lower === 'viejo' || lower.startsWith('vaca vieja') || lower.startsWith('viejo flaco')) {
    return 'Vejez';
  }
  // Reacción a vacuna/desparasitante (typo común "despracitante")
  if (lower.includes('reacción') || lower.includes('reaccion') || lower.includes('despracitante') || lower.includes('desparacitante')) {
    return 'Reacción a vacuna/desparasitante';
  }
  // Normalizar capitalización para el resto: primera letra mayúscula
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
}

export function MortandadPage({ mortandad, campos }: Props) {
  const [filtros, setFiltros] = useState<SimpleFiltros>(SIMPLE_FILTROS_DEFAULT);

  const filtradas = useMemo(() => {
    return mortandad.filter(m => {
      if (!enPeriodo(m.fecha, filtros)) return false;
      if (filtros.campoId !== 'todos' && m.campoId !== filtros.campoId) return false;
      return true;
    });
  }, [mortandad, filtros]);

  // Años con data — para alimentar el dropdown del filtro.
  const añosDisponibles = useMemo(
    () => añosEnData(mortandad.map(m => m.fecha)),
    [mortandad],
  );

  // ---------- KPIs + chart data ----------
  const { porCampo, porCategoria, porActividad, porCausa, porMes, porDia, topCampo, topCategoria, topCausa, totalMuertesDistinct } = useMemo(() => {
    const byCampo = new Map<string, number>();
    const byCat = new Map<string, number>();
    const byAct = new Map<string, number>();
    const byCausa = new Map<string, number>();
    const byMes = new Map<string, number>();
    const byDia = new Map<string, number>();
    // DISTINCTCOUNT(N° Caravana) — replica la fórmula DAX del Power BI.
    // Cada caravana distinta es 1 muerte, sin importar cuántas rows tenga
    // (a veces hay rows duplicadas por re-registro del síntoma vs causa).
    const caravanasUnicas = new Set<string>();

    filtradas.forEach(m => {
      byCampo.set(m.campoId, (byCampo.get(m.campoId) ?? 0) + 1);
      const cat = m.categoria || 'Sin categoría';
      byCat.set(cat, (byCat.get(cat) ?? 0) + 1);
      // Replica el chart "Total Muertes by Actividad" del Power BI del cliente.
      // actividad es texto libre del catálogo (Cria, Destete Precoz, Recria P, etc.).
      const act = m.actividad?.trim() || 'Sin actividad';
      byAct.set(act, (byAct.get(act) ?? 0) + 1);
      // Normalizamos la causa para agrupar abreviaciones y typos comunes:
      // los operarios cargan a mano y aparecen "Neumo" / "Neumonía" como dos
      // causas distintas. También consolidamos las variantes de "sin info"
      // bajo un único bucket "Sin identificar" — así el donut destaca las
      // causas reales en vez de inflarse de ruido.
      //
      // Fuente: el sheet del cliente carga las causas reales (Tristeza,
      // Neumonía, Distocia, etc.) en `causa_detalle` (texto libre).
      // `causa_tipo` quedó como enum chico ('Muerte Señalado' / 'Nacido
      // Muerto' / 'Desconocido') que casi nunca se usa. Probamos detalle
      // primero, después tipo, y por último "Sin identificar".
      const causa = normalizarCausa(m.causaDetalle ?? m.causaTipo);
      byCausa.set(causa, (byCausa.get(causa) ?? 0) + 1);
      const mes = m.fecha.slice(0, 7);
      byMes.set(mes, (byMes.get(mes) ?? 0) + 1);
      // Time series por día — para que Agus vea qué día murió cada animal
      // (picos de eventos = chequear qué pasó). El bar chart mensual oculta
      // este detalle.
      const dia = m.fecha.slice(0, 10);
      byDia.set(dia, (byDia.get(dia) ?? 0) + 1);
      // Caravana única para el conteo total. Sin caravana → trackeamos por id.
      const key = m.caravanaNumero?.trim() || `__noid__:${m.id}`;
      caravanasUnicas.add(key);
    });

    const porCampo = campos
      .map(c => ({ campo: c.nombre, n: byCampo.get(c.id) ?? 0 }))
      .filter(r => r.n > 0)
      .sort((a, b) => b.n - a.n);
    const porCategoria = [...byCat.entries()]
      .map(([categoria, n]) => ({ categoria, n }))
      .sort((a, b) => b.n - a.n);
    const porActividad = [...byAct.entries()]
      .map(([actividad, n]) => ({ actividad, n }))
      .sort((a, b) => b.n - a.n);
    const porCausa = [...byCausa.entries()]
      .map(([causa, n]) => ({ causa, n }))
      .sort((a, b) => b.n - a.n);

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const porMes = [...byMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, n]) => {
        const [y, m] = key.split('-');
        const idx = Math.max(0, Math.min(11, parseInt(m ?? '1', 10) - 1));
        return { mes: `${MESES[idx]} ${(y ?? '').slice(2)}`, n };
      });

    // Serie diaria — rellenamos los días sin muertes con n=0 para que la
    // curva refleje la distribución temporal real (rachas de mortandad vs
    // períodos calmos). Si el rango es muy largo (>1 año) mostramos solo
    // los días con eventos para no inflar la serie.
    const porDia: Array<{ fecha: string; label: string; n: number }> = [];
    const diasConDato = [...byDia.keys()].sort();
    if (diasConDato.length > 0) {
      const desde = new Date(diasConDato[0] + 'T00:00:00');
      const hasta = new Date(diasConDato[diasConDato.length - 1] + 'T00:00:00');
      const dias = Math.round((hasta.getTime() - desde.getTime()) / 86400000) + 1;
      if (dias <= 365) {
        for (let i = 0; i < dias; i++) {
          const d = new Date(desde.getTime() + i * 86400000);
          const key = d.toISOString().slice(0, 10);
          porDia.push({
            fecha: key,
            label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
            n: byDia.get(key) ?? 0,
          });
        }
      } else {
        for (const key of diasConDato) {
          const d = new Date(key + 'T00:00:00');
          porDia.push({
            fecha: key,
            label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
            n: byDia.get(key) ?? 0,
          });
        }
      }
    }

    return {
      porCampo, porCategoria, porActividad, porCausa, porMes, porDia,
      topCampo: porCampo[0] ?? null,
      topCategoria: porCategoria[0] ?? null,
      topCausa: porCausa[0] ?? null,
      totalMuertesDistinct: caravanasUnicas.size,
    };
  }, [filtradas, campos]);

  if (mortandad.length === 0) {
    return <EmptyModule label="muertes" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mortandad"
        subtitle="Animales muertos (fuera de parto) — agrupado por categoría, causa y campo."
        count={{ value: filtradas.length, label: 'eventos' }}
        lastDate={filtradas[0]?.fecha}
        actions={
          <ExportCsvButton
            onClick={() => exportMortandad(filtradas, campos)}
            disabled={filtradas.length === 0}
            count={filtradas.length}
          />
        }
      />

      <SimpleFilterBar filtros={filtros} campos={campos} onChange={setFiltros} añosDisponibles={añosDisponibles} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Total muertes"
          // DISTINCTCOUNT(N° Caravana) — el Power BI de Ganaderas cuenta caravanas
          // únicas, no rows. Una vaca con dos eventos asociados (típico cuando se
          // registra primero el síntoma y luego la causa) cuenta como 1 muerte.
          // Eventos sin caravana caen en un grupo "sin caravana" y se cuentan como 1.
          value={formatNumber(totalMuertesDistinct)}
          accent="terracota"
          icon={<SkullIcon size={18} />}
        />
        <Kpi
          label="Categoría top"
          value={topCategoria?.categoria ?? '—'}
          sublabel={topCategoria ? `${formatNumber(topCategoria.n)} animales` : ''}
          accent="navy"
          icon={<TagIcon size={18} />}
        />
        <Kpi
          label="Causa top"
          value={topCausa?.causa ?? '—'}
          sublabel={topCausa ? `${formatNumber(topCausa.n)} casos` : ''}
          accent="navy"
          icon={<AlertTriangleIcon size={18} />}
        />
        <Kpi
          label="Campo top"
          value={topCampo?.campo ?? '—'}
          sublabel={topCampo ? `${formatNumber(topCampo.n)} eventos` : ''}
          accent="orange"
          icon={<MapPinIcon size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Evolución mensual"
          subtitle="Muertes registradas por mes"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porMes} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
              <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip />
              <Bar dataKey="n" name="Muertes" fill="#C9823F" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="n" position="top" fontSize={11} fill="#163349" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Causa de muerte" subtitle="Distribución de causas">
          <CausaMuerteDonut data={porCausa} />
        </Card>
      </div>

      {/* Distribución diaria — Agus pidió ver el día exacto de cada muerte
          para investigar qué pasó ese día (manejo, sanidad, clima). El bar
          chart mensual oculta este detalle. La curva rellena con n=0 los
          días sin muertes para que se note el ritmo real (rachas vs calma). */}
      <Card
        title="Distribución diaria de muertes"
        subtitle={
          porDia.length === 0
            ? 'Sin muertes en el período'
            : `${porDia.length} días en el rango — cada barra es un día`
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={porDia} margin={{ top: 16, right: 16, left: -8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#6B7280"
              fontSize={10}
              interval={porDia.length > 60 ? Math.floor(porDia.length / 12) : 'preserveStartEnd'}
            />
            <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
            <Tooltip
              formatter={(v: number) => [`${v} muertes`, 'Día']}
              labelFormatter={(_, p) => {
                const item = p?.[0]?.payload as { fecha?: string } | undefined;
                return item?.fecha ?? '';
              }}
            />
            <Area
              type="monotone"
              dataKey="n"
              stroke="#C9423F"
              fill="#C9423F"
              fillOpacity={0.35}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Mapa con GPS de cada muerte — pedido específico de Agus para ver
          dónde ocurrieron los eventos y detectar patrones espaciales (zonas
          de pozos, monte denso, agua estancada, picaduras). El componente
          maneja internamente los 3 estados: sin data, sin GPS, con data.
          Color por causa = consistente con el donut "Causa de muerte". */}
      <Card title="Mapa de muertes" subtitle="Ubicación GPS capturada al cargar el evento — color por causa">
        <MortandadMap
          mortandad={filtradas}
          campoNombre={(id) => campos.find(c => c.id === id)?.nombre ?? id}
          normalizarCausa={normalizarCausa}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Por categoría" subtitle="Animales más afectados" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porCategoria} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" vertical={false} />
              <XAxis dataKey="categoria" stroke="#6B7280" fontSize={11} angle={-15} textAnchor="end" height={60} interval={0} />
              <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="n" name="Muertes" fill="#163349" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="n" position="top" fontSize={11} fill="#163349" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Por campo" subtitle="Ranking">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porCampo} layout="vertical" margin={{ top: 8, right: 36, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" horizontal={false} />
              <XAxis type="number" stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="campo" stroke="#6B7280" fontSize={12} width={90} />
              <Tooltip />
              <Bar dataKey="n" radius={[0, 4, 4, 0]}>
                {porCampo.map((_, i) => <Cell key={i} fill="#FF8409" />)}
                <LabelList dataKey="n" position="right" fontSize={11} fill="#163349" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Total Muertes by Actividad — replica del Power BI del cliente.
          Útil para ver si las muertes se concentran en Cría, Destete Precoz,
          Recría o etapas posteriores (Engorde / Invernada). */}
      <Card title="Por actividad" subtitle="Distribución de muertes según etapa productiva">
        {porActividad.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-asfion-muted">
            Sin actividad registrada en las muertes del período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, porActividad.length * 42)}>
            <BarChart data={porActividad} layout="vertical" margin={{ top: 8, right: 60, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DD" horizontal={false} />
              <XAxis type="number" stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="actividad" stroke="#6B7280" fontSize={12} width={140} />
              <Tooltip />
              <Bar dataKey="n" name="Muertes" radius={[0, 4, 4, 0]}>
                {porActividad.map((_, i) => <Cell key={i} fill="#C9823F" />)}
                <LabelList dataKey="n" position="right" fontSize={11} fill="#163349" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

// Export CSV de mortandad — una fila por evento.
function exportMortandad(rows: Mortandad[], campos: Campo[]): void {
  const campoNombre = (id: string) => campos.find(c => c.id === id)?.nombre ?? id;
  const cols: CsvColumn<Mortandad>[] = [
    { header: 'Fecha',           value: r => r.fecha },
    { header: 'Campo',           value: r => campoNombre(r.campoId) },
    { header: 'Lote',            value: r => r.loteId ?? '' },
    { header: 'Categoría',       value: r => r.categoria },
    { header: 'Actividad',       value: r => r.actividad ?? '' },
    { header: 'Causa tipo',      value: r => r.causaTipo ?? '' },
    { header: 'Causa detalle',   value: r => r.causaDetalle ?? '' },
    { header: 'Caravana color',  value: r => r.caravanaColor ?? '' },
    { header: 'Caravana número', value: r => r.caravanaNumero ?? '' },
    { header: 'Observaciones',   value: r => r.observaciones ?? '' },
    { header: 'Cargado por',     value: r => r.usuarioEmail },
    { header: 'Fecha de carga',  value: r => r.createdAt },
  ];
  const csv = rowsToCsv(rows, cols);
  downloadCsv(csv, csvFilename('mortandad'));
}

// Donut de Causa de muerte — replica el patrón del Power BI que pidió el
// cliente. Asigna colores deterministas por nombre de causa, fallback a
// paleta cíclica para causas nuevas. Leyenda a la derecha con conteo y %.
function CausaMuerteDonut({ data }: { data: Array<{ causa: string; n: number }> }) {
  // Paleta brand para las causas más frecuentes en Ganaderas. Conservamos
  // los nombres del Power BI del cliente pero reasignamos los hex a la
  // paleta brand: Tristeza (la dominante) en orange, status reales en
  // amber/danger/terracota, descriptivos neutros en navy/blueSoft/gris.
  // Para causas nuevas que no estén acá, ciclamos por CHART_PALETTE.
  const FIXED: Record<string, string> = {
    'Tristeza':              '#FF8409', // orange brand (dominante)
    'Distocia':              '#D89425', // amber (warning)
    'Rabia':                 '#C9423F', // danger
    'Problema respiratorio': '#163349', // navy (descriptivo)
    'Sin identificar':       '#C9823F', // terracota
    'Sin especificar':       '#9AA3A8', // gris neutro (sin info)
    'Callo en un pozo':      '#6B9DBE', // blueSoft (templado, on-brand)
    'Tristeza/Anaplas':      '#FFCB95', // peach (variante de Tristeza)
  };
  const FALLBACK = ['#163349', '#FF8409', '#FFCB95', '#C9823F', '#6B9DBE', '#D89425', '#0F2535', '#3FAE5A'];

  let fallbackIdx = 0;
  const serie = data
    .filter(d => d.n > 0)
    .map(d => ({
      name: d.causa,
      value: d.n,
      fill: FIXED[d.causa] ?? FALLBACK[(fallbackIdx++) % FALLBACK.length],
    }));

  const total = serie.reduce((acc, s) => acc + s.value, 0);
  if (total === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-asfion-muted">
        Sin causas registradas
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4">
      <div className="w-full md:w-[50%] h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={serie}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
            >
              {serie.map(s => <Cell key={s.name} fill={s.fill} />)}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [`${v} casos`, n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda con nombre, conteo y %. Compatible con el patrón visual
          del Power BI (etiqueta + número + porcentaje). */}
      <div className="flex-1 flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
        {serie.map(s => (
          <div key={s.name} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: s.fill }}
            />
            <span className="flex-1 truncate font-semibold text-asfion-navy" title={s.name}>
              {s.name}
            </span>
            <span className="tabular-nums text-asfion-muted">{s.value}</span>
            <span className="tabular-nums text-asfion-muted w-12 text-right">
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

