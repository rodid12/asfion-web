// Mapa de mortandad — muestra dónde ocurrió cada muerte registrada con GPS.
//
// Por qué importa: en ganadería extensiva los animales se mueren por causas
// del entorno (pozos, monte cerrado, agua estancada, picaduras de víboras,
// rayos). Ver el mapa con los pins agrupados revela patrones que en una
// tabla no se ven: "todas las muertes de Picaflor en el monte sur — capaz
// hay agua estancada", "tres rabias en Quirquincho cerca del límite norte".
//
// Usamos react-leaflet con tiles de OpenStreetMap (gratis, sin API key).
// El componente carga leaflet de forma lazy (dynamic import) para que el
// bundle inicial del dashboard NO incluya 200kb de leaflet — solo se baja
// cuando el usuario abre la página Mortandad.
//
// Colores de pins por causa normalizada — usamos la misma paleta que el
// donut "Causa de muerte" para que sea visualmente consistente.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Mortandad } from '@/data/types';
import { safeHtml } from '@/lib/html';

interface Props {
  mortandad: Mortandad[];
  /** Función opcional para conseguir el nombre del campo desde el ID. */
  campoNombre?: (campoId: string) => string;
  /** Función opcional para normalizar la causa (misma que en MortandadPage). */
  normalizarCausa?: (causa: string | null | undefined) => string;
}

// Paleta brand — réplica de la del CausaMuerteDonut.
const COLOR_CAUSA: Record<string, string> = {
  'Tristeza':              '#FF8409',
  'Distocia':              '#D89425',
  'Rabia':                 '#C9423F',
  'Neumonía':              '#3FAE5A',
  'Problema respiratorio': '#163349',
  'Sin identificar':       '#9AA3A8',
};
const COLOR_DEFAULT = '#6B9DBE';

export function MortandadMap({ mortandad, campoNombre, normalizarCausa }: Props) {
  // Filtramos rows con GPS válido. El operario puede cargar sin señal y eso
  // hace que vengan en null o como (0,0) — descartamos esos.
  const conGps = useMemo(() => {
    return mortandad.filter(m =>
      typeof m.gpsLat === 'number' &&
      typeof m.gpsLon === 'number' &&
      Number.isFinite(m.gpsLat) &&
      Number.isFinite(m.gpsLon) &&
      // 0,0 es null-island — datos basura
      !(m.gpsLat === 0 && m.gpsLon === 0)
    );
  }, [mortandad]);

  // Lazy load leaflet — solo cuando el componente está montado en el DOM.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Dynamic imports — el bundle de leaflet (200kb) solo se baja al
        // entrar a la página Mortandad por primera vez en la sesión.
        // El @vite-ignore + @ts-ignore son para evitar warnings cuando
        // leaflet no está instalado todavía (caso típico de primer setup).
        // @ts-ignore: leaflet se resuelve en runtime tras npm install
        const L = (await import(/* @vite-ignore */ 'leaflet')).default;
        // @ts-ignore: idem CSS
        await import(/* @vite-ignore */ 'leaflet/dist/leaflet.css');
        if (cancelled) return;

        // Hack conocido de leaflet con bundlers — los íconos default no
        // resuelven bien por path. Lo arreglamos con CDN inline.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Icon = (L.Icon.Default.prototype as any);
        delete Icon._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        if (!containerRef.current || mapRef.current) return;

        // Centro inicial = promedio de los puntos. Si no hay puntos válidos,
        // fallback a centro de Argentina (Bermejo, Salta — aprox zona GVA).
        const center = conGps.length > 0
          ? [
              conGps.reduce((s, m) => s + (m.gpsLat ?? 0), 0) / conGps.length,
              conGps.reduce((s, m) => s + (m.gpsLon ?? 0), 0) / conGps.length,
            ] as [number, number]
          : [-23.5, -64.0] as [number, number];

        const map = L.map(containerRef.current, {
          center,
          zoom: conGps.length > 0 ? 11 : 6,
          scrollWheelZoom: true,
        });
        mapRef.current = map;

        // Tiles de OpenStreetMap — gratis, sin API key, con attribution
        // requerido (lo metemos en una "© OpenStreetMap" abajo).
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        // Una capa con los pins. Usamos circleMarker (no marker default)
        // para colorearlos por causa.
        const bounds: Array<[number, number]> = [];
        conGps.forEach(m => {
          const lat = m.gpsLat as number;
          const lon = m.gpsLon as number;
          // El cliente carga las causas reales en causaDetalle (Tristeza,
          // Neumonía, etc.) — probamos detalle primero, después tipo.
          const causa = normalizarCausa
            ? normalizarCausa(m.causaDetalle ?? m.causaTipo)
            : (m.causaDetalle ?? m.causaTipo ?? 'Sin identificar');
          const color = COLOR_CAUSA[causa] ?? COLOR_DEFAULT;
          const campo = campoNombre ? campoNombre(m.campoId) : m.campoId;
          // safeHtml escapa cada ${...} automáticamente — bloquea XSS via
          // `<script>` o `<img onerror>` que un operario podría tipear en
          // observaciones para ejecutar JS en sesiones de otros usuarios
          // del mismo tenant (RLS no aplica porque comparten cliente_id).
          const popupHtml = safeHtml`
            <div style="font-family: ui-sans-serif, system-ui; min-width: 180px;">
              <div style="font-weight: 700; color: #163349; margin-bottom: 4px;">
                ${campo}
              </div>
              <div style="font-size: 12px; color: #6B7280; margin-bottom: 6px;">
                ${m.fecha} · ${m.categoria}
              </div>
              <div style="font-size: 12px;">
                <strong>Causa:</strong> ${causa}
              </div>
            </div>
          ` + (m.caravanaNumero
              ? safeHtml`<div style="font-size: 12px;"><strong>Caravana:</strong> ${m.caravanaNumero}</div>`
              : '')
            + (m.observaciones
              ? safeHtml`<div style="font-size: 11px; color: #6B7280; margin-top: 6px;">${m.observaciones}</div>`
              : '');
          L.circleMarker([lat, lon], {
            radius: 7,
            fillColor: color,
            color: '#fff',
            weight: 2,
            fillOpacity: 0.85,
          })
            .bindPopup(popupHtml)
            .addTo(map);
          bounds.push([lat, lon]);
        });

        // Si hay puntos, encuadramos el mapa para que entren todos.
        if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [40, 40] });
        }

        setLeafletReady(true);
      } catch (err: any) {
        setLoadError(err?.message ?? 'Error cargando el mapa');
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conGps]);

  if (mortandad.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-sm text-asfion-muted bg-asfion-bg/40 rounded-lg">
        Sin muertes registradas.
      </div>
    );
  }

  if (conGps.length === 0) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center gap-2 text-center px-6 text-sm text-asfion-muted bg-asfion-bg/40 rounded-lg">
        <p className="font-semibold text-asfion-navy">Ninguna muerte tiene GPS registrado todavía.</p>
        <p className="text-xs max-w-md">
          La app móvil empezó a capturar coordenadas en la última versión.
          Las muertes cargadas a partir de ahora van a aparecer acá. Los
          operarios necesitan dar permiso de ubicación y tener señal GPS
          al cargar.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-[400px] flex items-center justify-center text-sm text-asfion-danger bg-asfion-danger/5 rounded-lg px-6 text-center">
        Error cargando el mapa: {loadError}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* h-[400px] da una altura razonable en desktop; en mobile lo dejamos
          un poco más corto para que entre con el resto del scroll. */}
      <div
        ref={containerRef}
        className="h-[360px] sm:h-[480px] w-full rounded-lg overflow-hidden"
      />
      {!leafletReady && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-asfion-muted bg-asfion-bg/60 rounded-lg pointer-events-none">
          Cargando mapa…
        </div>
      )}

      {/* Leyenda de causas — colores que matchean con el donut */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <p className="text-asfion-muted font-semibold uppercase tracking-wide mr-1">Causa:</p>
        {Object.entries(COLOR_CAUSA).map(([causa, color]) => (
          <span key={causa} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-asfion-navy">{causa}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_DEFAULT }} />
          <span className="text-asfion-navy">Otras</span>
        </span>
      </div>

      <p className="mt-2 text-[10px] text-asfion-muted">
        {conGps.length} de {mortandad.length} muertes con GPS · Tiles © OpenStreetMap
      </p>
    </div>
  );
}
