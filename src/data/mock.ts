// Mock data generator calibrado contra los datos reales del AppSheet
// (GVA_F(6).xlsx, exportación 2026-04-22).
//
// Volumen real observado: 2.546 pariciones, 8 meses (ago 2025 - abr 2026),
// 6 operarios activos, 4 campos con carga activa.
//
// Genera ~2500 pariciones deterministas (seed fija) para que el dashboard
// no "parpadee" con datos distintos en cada reload.
//
// Cuando conectemos Supabase, este archivo se reemplaza por un hook
// `useParicionesFromSupabase()` — el resto del dashboard no cambia.

import type {
  Campo,
  CaravanaColor,
  CausaMuerteTipo,
  EventoParicion,
  Paricion,
  Sexo,
  SiNo,
  SyncState,
  VacasGrupo,
} from './types';

// 9 campos reales (después de unificar Ico/Iko Pozo)
export const CAMPOS: Campo[] = [
  { id: 'campo-agisot',      nombre: 'Agisot' },
  { id: 'campo-carolina',    nombre: 'Carolina' },
  { id: 'campo-corrales',    nombre: 'Corrales' },
  { id: 'campo-curupayti',   nombre: 'Curupayti' },
  { id: 'campo-ico-pozo',    nombre: 'Ico Pozo' },
  { id: 'campo-margarita',   nombre: 'Margarita' },
  { id: 'campo-picaflor',    nombre: 'Picaflor' },
  { id: 'campo-progreso',    nombre: 'Progreso' },
  { id: 'campo-quirquincho', nombre: 'Quirquincho' },
];

// Operarios reales que cargan pariciones (extraídos del xlsx)
const USUARIOS_REALES = [
  'nelsonisidrolopez2025@gmail.com',
  'alejandromiguel9087@gmail.com',
  'emilianogabrielzerpa5@gmail.com',
  'ruedaroberto431@gmail.com',
  'luisfernandocarranza155@gmail.com',
  'armandocollante15@gmail.com',
] as const;

// Mapa operario → campo asignado (también del xlsx, tabla Usuarios)
const USUARIO_CAMPO: Record<string, string> = {
  'nelsonisidrolopez2025@gmail.com':   'campo-quirquincho',
  'alejandromiguel9087@gmail.com':     'campo-progreso',
  'emilianogabrielzerpa5@gmail.com':   'campo-carolina',
  'ruedaroberto431@gmail.com':         'campo-picaflor',
  'luisfernandocarranza155@gmail.com': 'campo-picaflor',
  'armandocollante15@gmail.com':       'campo-quirquincho',
};

// Causas de muerte reales (nivel 2), con distribución realista
const CAUSAS_SEÑALADO = [
  'Insolación',
  'Diarrea',
  'Calor',
  'Picadura de víbora',
  'Empantanado',
  'Cayó en el canal',
  'Mancha',
  'Reacción desparasitante',
  'Intususcepción intestinal',
  'Insuficiencia de minerales',
  'Desconocido',
  'Desconocido',  // peso 2x para reflejar que aparece más
  'Desconocido',
];

// PRNG determinístico (mulberry32). Con seed fija → data fija.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(rand: () => number, items: Array<[T, number]>): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[0]![0];
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Formatos de caravana observados en los datos reales:
//   - numéricos de 4 dígitos: "0200", "0201", "0202"
//   - alfanuméricos largos: "JT764O504", "Xj775-B190"
// El segundo formato aparece menos seguido.
function generarCaravanaNumero(rand: () => number): string {
  if (rand() < 0.85) {
    return String(Math.floor(rand() * 500) + 100).padStart(4, '0');
  }
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const l1 = pick(rand, letras.split(''));
  const l2 = pick(rand, letras.split(''));
  const n1 = Math.floor(rand() * 900) + 100;
  const l3 = pick(rand, letras.split(''));
  const n2 = Math.floor(rand() * 900) + 100;
  return rand() < 0.5
    ? `${l1}${l2}${n1}${l3}${n2}`
    : `${l1}${l2.toLowerCase()}${n1}-${l3}${n2}`;
}

export function generarPariciones(n = 2500, seed = 42): Paricion[] {
  const rand = mulberry32(seed);
  const out: Paricion[] = [];
  const hoy = new Date('2026-04-22');
  // Ventana real observada: 2025-08-06 → 2026-04-06
  const desde = new Date('2025-08-01');

  for (let i = 0; i < n; i++) {
    // Distribución temporal: pico primavera-verano (Aug-Nov) concentra el grueso.
    let fecha: Date;
    const rollTemporal = rand();
    if (rollTemporal < 0.70) {
      // 70% en agosto-noviembre 2025 (pico de pariciones)
      const mes = Math.floor(rand() * 4) + 7; // 7=Aug .. 10=Nov
      const dia = Math.floor(rand() * 28) + 1;
      fecha = new Date(2025, mes, dia);
    } else if (rollTemporal < 0.90) {
      // 20% diciembre 2025 - febrero 2026 (cola del servicio)
      const offset = Math.floor(rand() * 3);
      const mes = (11 + offset) % 12;
      const year = 11 + offset >= 12 ? 2026 : 2025;
      const dia = Math.floor(rand() * 28) + 1;
      fecha = new Date(year, mes, dia);
    } else {
      // 10% resto de la ventana (residual)
      const spanDays = (hoy.getTime() - desde.getTime()) / 86400_000;
      const days = Math.floor(rand() * spanDays);
      fecha = new Date(desde.getTime() + days * 86400_000);
    }
    // Clampear: no generamos fechas futuras
    if (fecha > hoy) fecha = new Date(hoy);

    // Operario → campo inferido de USUARIO_CAMPO, con 5% de "ayuda a otro campo"
    const usuario = pickWeighted(rand, [
      ['nelsonisidrolopez2025@gmail.com',   30], // Quirquincho
      ['alejandromiguel9087@gmail.com',     25], // Progreso
      ['emilianogabrielzerpa5@gmail.com',   18], // Carolina
      ['ruedaroberto431@gmail.com',         14], // Picaflor
      ['luisfernandocarranza155@gmail.com', 10], // Picaflor
      ['armandocollante15@gmail.com',        3], // Quirquincho (poco activo)
    ] as Array<[string, number]>);
    const campo = rand() < 0.05
      ? pick(rand, CAMPOS.map(c => c.id))
      : USUARIO_CAMPO[usuario] ?? 'campo-progreso';

    // Evento: en los datos reales históricos Retacto nunca se cargó, pero el
    // amigo confirmó que SÍ se usa (re-chequeo de preñez). Le damos peso chico
    // para que aparezca en el dashboard como caso existente.
    const evento = pickWeighted<EventoParicion>(rand, [
      ['Nacimiento', 84],   // el grueso
      ['Muerte',      8],
      ['Aborto',      6],
      ['Retacto',     2],
    ]);

    const sexo: Sexo | undefined =
      evento === 'Nacimiento' ? pickWeighted<Sexo>(rand, [
        ['Macho',   47],
        ['Hembra',  47],
        ['Orejano',  6],
      ]) : undefined;

    const vacasGrupo = pickWeighted<VacasGrupo>(rand, [
      ['Vacas cabeza', 30],
      ['Vaca cuerpo',  55],
      ['Vaca cola',    15],
    ]);

    const asistencia: SiNo | undefined =
      evento === 'Nacimiento' ? (rand() < 0.18 ? 'Si' : 'No') : undefined;

    // Causa cascade (solo para muerte/aborto)
    let causaTipo: CausaMuerteTipo | undefined;
    let causaDetalle: string | undefined;
    if (evento === 'Muerte' || evento === 'Aborto') {
      causaTipo = pickWeighted<CausaMuerteTipo>(rand, [
        ['Muerte Señalado', 55],
        ['Nacido Muerto',   30],
        ['Desconocido',     15],
      ]);
      if (causaTipo === 'Muerte Señalado') {
        causaDetalle = pick(rand, CAUSAS_SEÑALADO);
      }
    }

    // Sync: 94% ok, resto pendiente o falló
    const rollSync = rand();
    const syncState: SyncState =
      rollSync < 0.94 ? 'synced' :
      rollSync < 0.98 ? 'pending' : 'failed';

    // Caravana: presente en ~90% de nacimientos, menos en muertes/abortos
    const tieneCaravana = evento === 'Nacimiento' ? rand() < 0.92 : rand() < 0.55;
    const caravanaColor: CaravanaColor | undefined = tieneCaravana
      ? pickWeighted<CaravanaColor>(rand, [
          ['Celeste',  35],
          ['Amarillo', 28],
          ['Blanca',   22],
          ['Naranja',  15],
        ])
      : undefined;
    const caravanaNumero = tieneCaravana ? generarCaravanaNumero(rand) : undefined;

    out.push({
      id: `p-${i.toString().padStart(5, '0')}`,
      fecha: fechaISO(fecha),
      campoId: campo,
      usuarioEmail: usuario,
      createdAt: fecha.toISOString(),
      syncState,
      vacasGrupo,
      evento,
      sexo,
      asistencia,
      caravanaColor,
      caravanaNumero,
      causaTipo,
      causaDetalle,
    });
  }

  // Orden desc por fecha
  out.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return out;
}

export const MOCK_PARICIONES = generarPariciones();
