import type { DashboardData } from '@/data/useData';
import type { Campo } from '@/data/types';

type WorkbookModuleData = Pick<DashboardData,
  | 'pariciones' | 'lluvias' | 'mortandad' | 'pastoreo' | 'pastoreoCiclos'
  | 'resumenServicio' | 'compras' | 'ventas' | 'ndvi' | 'tactos' | 'corrales'
>;

export interface ExportWorkbookArgs {
  clienteId: string;
  clienteNombre: string;
  campaniaNombre: string;
  fechaInicio: string;
  fechaFin: string;
  campos: Campo[];
  data: WorkbookModuleData;
}

type CellValue = string | number | boolean | null;
type SheetDefinition = { name: string; rows: Array<Record<string, unknown>> };

const encoder = new TextEncoder();
const INVALID_SHEET_CHARS = /[\\/?*:[\]]/g;

function scalar(value: unknown): CellValue {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(item => scalar(item)).join(' | ');
  return JSON.stringify(value);
}

function xml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rowsWithCampo(rows: Array<Record<string, unknown>>, campos: Campo[]): Array<Record<string, unknown>> {
  const nombres = new Map(campos.map(c => [c.id, c.nombre]));
  return rows.map(row => ({
    ...row,
    ...(typeof row.campoId === 'string' ? { campoNombre: nombres.get(row.campoId) ?? row.campoId } : {}),
  }));
}

function allColumns(rows: Array<Record<string, unknown>>): string[] {
  const seen = new Set<string>();
  rows.forEach(row => Object.keys(row).forEach(key => seen.add(key)));
  return [...seen];
}

function safeSheetName(name: string): string {
  return name.replace(INVALID_SHEET_CHARS, '-').slice(0, 31) || 'Hoja';
}

function columnName(index: number): string {
  let current = index + 1;
  let out = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    current = Math.floor((current - 1) / 26);
  }
  return out;
}

function cellXml(value: CellValue, ref: string, header = false): string {
  const style = header ? ' s="1"' : '';
  if (value == null) return `<c r="${ref}"${style}/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"${style}><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function worksheetXml(source: Array<Record<string, unknown>>, campos: Campo[]): string {
  const rows = rowsWithCampo(source, campos);
  if (rows.length === 0) rows.push({ estado: 'Sin registros para la campaña seleccionada' });
  const columns = allColumns(rows);
  const headerCells = columns.map((key, i) => cellXml(key, `${columnName(i)}1`, true)).join('');
  const body = rows.map((row, rowIndex) => {
    const cells = columns.map((key, columnIndex) =>
      cellXml(scalar(row[key]), `${columnName(columnIndex)}${rowIndex + 2}`)).join('');
    return `<row r="${rowIndex + 2}">${cells}</row>`;
  }).join('');
  const lastCell = `${columnName(Math.max(0, columns.length - 1))}${rows.length + 1}`;
  const cols = columns.map((key, i) => {
    const width = Math.min(42, Math.max(14, key.length + 2));
    return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${cols}</cols>
  <sheetData><row r="1">${headerCells}</row>${body}</sheetData>
  <autoFilter ref="A1:${lastCell}"/>
</worksheet>`;
}

function workbookEntries(sheets: SheetDefinition[], campos: Campo[]): Array<{ name: string; data: Uint8Array }> {
  const sheetNames = sheets.map(sheet => safeSheetName(sheet.name));
  const contentOverrides = sheets.map((_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const workbookSheets = sheetNames.map((name, index) =>
    `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const workbookRels = sheets.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  const styleRelId = sheets.length + 1;

  const textEntries: Array<{ name: string; text: string }> = [
    {
      name: '[Content_Types].xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${contentOverrides}
</Types>`,
    },
    {
      name: '_rels/.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${styleRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF163349"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
    },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      text: worksheetXml(sheet.rows, campos),
    })),
  ];
  return textEntries.map(entry => ({ name: entry.name, data: encoder.encode(entry.text) }));
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view: DataView, offset: number, value: number): void { view.setUint16(offset, value, true); }
function write32(view: DataView, offset: number, value: number): void { view.setUint32(offset, value >>> 0, true); }

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

// ZIP "store" (sin compresión): suficiente para OpenXML, evita dependencias
// externas y mantiene el exportador auditable dentro del repositorio.
function zip(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    write32(lv, 0, 0x04034b50); write16(lv, 4, 20); write16(lv, 6, 0); write16(lv, 8, 0);
    write16(lv, 10, 0); write16(lv, 12, 0); write32(lv, 14, crc);
    write32(lv, 18, entry.data.length); write32(lv, 22, entry.data.length);
    write16(lv, 26, name.length); write16(lv, 28, 0); local.set(name, 30);
    localParts.push(local, entry.data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    write32(cv, 0, 0x02014b50); write16(cv, 4, 20); write16(cv, 6, 20); write16(cv, 8, 0);
    write16(cv, 10, 0); write16(cv, 12, 0); write16(cv, 14, 0); write32(cv, 16, crc);
    write32(cv, 20, entry.data.length); write32(cv, 24, entry.data.length); write16(cv, 28, name.length);
    write16(cv, 30, 0); write16(cv, 32, 0); write16(cv, 34, 0); write16(cv, 36, 0);
    write32(cv, 38, 0); write32(cv, 42, localOffset); central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + entry.data.length;
  }

  const centralDirectory = concat(centralParts);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  write32(ev, 0, 0x06054b50); write16(ev, 4, 0); write16(ev, 6, 0);
  write16(ev, 8, entries.length); write16(ev, 10, entries.length);
  write32(ev, 12, centralDirectory.length); write32(ev, 16, localOffset); write16(ev, 20, 0);
  return concat([...localParts, centralDirectory, end]);
}

function sheetDefinitions(args: ExportWorkbookArgs): SheetDefinition[] {
  return [
    { name: 'Resumen', rows: [{ clienteId: args.clienteId, cliente: args.clienteNombre, campania: args.campaniaNombre, fechaInicio: args.fechaInicio, fechaFin: args.fechaFin, exportadoEl: new Date().toLocaleString('es-AR') }] },
    { name: 'Campos', rows: args.campos as unknown as Array<Record<string, unknown>> },
    { name: 'Pariciones', rows: args.data.pariciones as unknown as Array<Record<string, unknown>> },
    { name: 'Lluvias', rows: args.data.lluvias as unknown as Array<Record<string, unknown>> },
    { name: 'Mortandad', rows: args.data.mortandad as unknown as Array<Record<string, unknown>> },
    { name: 'Pastoreo', rows: args.data.pastoreo as unknown as Array<Record<string, unknown>> },
    { name: 'Ciclos Pastoreo', rows: args.data.pastoreoCiclos as unknown as Array<Record<string, unknown>> },
    { name: 'Compras', rows: args.data.compras as unknown as Array<Record<string, unknown>> },
    { name: 'Ventas', rows: args.data.ventas as unknown as Array<Record<string, unknown>> },
    { name: 'Preñez - Tactos', rows: args.data.tactos as unknown as Array<Record<string, unknown>> },
    { name: 'Resumen Pariciones', rows: args.data.resumenServicio as unknown as Array<Record<string, unknown>> },
    { name: 'NDVI - MS', rows: args.data.ndvi as unknown as Array<Record<string, unknown>> },
    { name: 'Corrales', rows: args.data.corrales as unknown as Array<Record<string, unknown>> },
  ];
}

export function buildDashboardWorkbookBytes(args: ExportWorkbookArgs): Uint8Array {
  return zip(workbookEntries(sheetDefinitions(args), args.campos));
}

export async function exportDashboardWorkbook(args: ExportWorkbookArgs): Promise<void> {
  const bytes = buildDashboardWorkbookBytes(args);
  const ownedBuffer = new ArrayBuffer(bytes.length);
  new Uint8Array(ownedBuffer).set(bytes);
  const blob = new Blob([ownedBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const slug = `${args.clienteId}-${args.campaniaNombre}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  anchor.href = url;
  anchor.download = `asfion-${slug || 'exportacion'}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
