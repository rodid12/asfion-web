// Utilidades para exportar a CSV.
//
// No usamos PapaParse — para escribir CSV no hay parsing complejo (lo
// difícil de PapaParse es leer .csv con encoding y bordes raros, no
// escribirlos). Mantenemos cero deps.
//
// Detalles importantes:
//   1. Encoding: prepend BOM ﻿ para que Excel respete acentos y eñes.
//   2. Separador: coma por default. Si el usuario tiene Excel ES-AR puede
//      necesitar punto y coma — exponemos `delimiter` opcional.
//   3. Quoting: SIEMPRE quoteamos campos con coma, comilla doble, salto
//      de línea, o que empiecen con caracteres "peligrosos" (=, +, -, @)
//      para mitigar CSV injection en Excel.
//   4. Booleans / nulls / undefined → string vacío.

export interface CsvColumn<T> {
  /** Encabezado en la primera fila. */
  header: string;
  /** Función que extrae el valor de la fila. Devolver string | number | null. */
  value: (row: T) => string | number | null | undefined;
}

export interface CsvOptions {
  delimiter?: string;  // default ','
  bom?: boolean;       // default true (para Excel UTF-8)
}

export function rowsToCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  opts: CsvOptions = {},
): string {
  const { delimiter = ',', bom = true } = opts;
  const header = columns.map(c => csvField(c.header, delimiter)).join(delimiter);
  const body = rows
    .map(r => columns.map(c => {
      const v = c.value(r);
      return csvField(v == null ? '' : String(v), delimiter);
    }).join(delimiter))
    .join('\r\n');
  return (bom ? '﻿' : '') + header + '\r\n' + body;
}

function csvField(s: string, delimiter: string): string {
  const needsQuote =
    s.includes(delimiter) ||
    s.includes('"') ||
    s.includes('\n') ||
    s.includes('\r') ||
    /^[=+\-@]/.test(s); // CSV injection guard
  if (!needsQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Dispara la descarga (o "compartir" en mobile) de un archivo CSV.
 *
 * En desktop usamos el patrón clásico: <a download> + blob URL → el
 * browser descarga el archivo al folder de Downloads.
 *
 * En mobile (iOS Safari sobre todo) <a download> con blob URL NO funciona:
 * abre el CSV como texto plano en la misma pestaña y el operario no
 * puede guardarlo. Detectamos eso y usamos `navigator.share()` con
 * `files` — abre el sheet nativo de "Compartir" del SO y el operario
 * elige: Mail, WhatsApp, Files, Drive, etc.
 *
 * Si nada de eso está disponible (browser muy viejo), fallback al
 * <a download> tradicional.
 */
export async function downloadCsv(csv: string, filename: string): Promise<void> {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  // Intentar Web Share API si:
  //   1. Estamos en un browser que la soporta
  //   2. El browser permite compartir archivos (no todas las versiones)
  //   3. Estamos en un device tipo mobile/tablet (heurística por touch)
  // En desktop, aunque navigator.share exista, mejor usar la descarga
  // tradicional — abrir el sheet de compartir en desktop es UX rara.
  const isMobile = typeof window !== 'undefined' && (
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
  );

  if (isMobile && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: 'text/csv' });
      // canShare valida que el browser acepte ese tipo de archivo.
      if (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: `Exportación ASFION — ${filename}`,
        });
        return;
      }
    } catch (err: any) {
      // El usuario canceló el sheet de compartir, o el browser no soporta
      // file share. AbortError es esperable — no caemos al fallback.
      if (err?.name === 'AbortError') return;
      // Otro error (raro) — caemos al fallback.
      console.warn('[csv] navigator.share falló, usando <a download>:', err);
    }
  }

  // Fallback: <a download> tradicional. Funciona perfecto en desktop y
  // en Android Chrome. En iOS Safari abre el CSV en la pestaña pero
  // ahí ya el operario puede hacer "Compartir → Guardar en archivos".
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // En iOS algunos browsers ignoran download — abrimos en otra pestaña
  // como mejora chica (sin reemplazar la actual).
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Genera un nombre de archivo con timestamp para descargas.
 * Ejemplo: asfion_pariciones_2026-05-29_14-32.csv
 */
export function csvFilename(modulo: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  return `asfion_${modulo}_${stamp}.csv`;
}
