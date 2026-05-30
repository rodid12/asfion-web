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
 * Dispara la descarga de un archivo CSV en el navegador.
 * Crea un blob, lo enchufa a un <a download>, lo clickea y lo limpia.
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Liberar la URL en el siguiente tick (algunos navegadores quieren que
  // la URL viva al menos hasta que el browser empezó la descarga).
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
