#!/usr/bin/env node
// =============================================================================
// sync-types.mjs — Sincroniza src/data/types.canonical.ts entre repos
// =============================================================================
//
// Copia types.canonical.ts del repo web al repo app, agregando un header
// de "no editar" para que sea obvio en el destination.
//
// Uso:
//   npm run sync-types         (desde asfion-web)
//
// Asume que asfion-app está al lado de asfion-web en el filesystem:
//   parent/
//     asfion-web/    ← lo corrés desde acá
//     asfion-app/    ← copia el archivo acá
//
// Si tu layout es distinto (asfion-app está en otro path), pasalo como arg:
//   node scripts/sync-types.mjs /path/al/asfion-app
//
// EXIT CODES:
//   0 — copia OK (o ya estaba sincronizado)
//   1 — error de I/O (no encuentra el destino, sin permisos, etc.)
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Path al repo app — primer arg de CLI o asume sibling directory
const APP_REPO = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(__dirname, '../../asfion-app');

if (!existsSync(APP_REPO)) {
  console.error(`❌ Repo app no encontrado: ${APP_REPO}`);
  console.error(`   Pasalo como argumento: node scripts/sync-types.mjs /path/al/asfion-app`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lista de archivos canónicos a sincronizar. Agregar acá cuando creemos
// más archivos compartidos (ej. dataMappers.canonical.ts, validators.canonical.ts).
// ─────────────────────────────────────────────────────────────────────────────
const FILES_TO_SYNC = [
  'src/data/types.canonical.ts',
  'src/data/mapRow.canonical.ts',
];

// ─────────────────────────────────────────────────────────────────────────────
// Header que se inyecta en cada destino
// ─────────────────────────────────────────────────────────────────────────────
function makeCopyHeader(srcRel) {
  return `// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                                                                           ║
// ║   ⚠️  ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR                          ║
// ║                                                                           ║
// ║   Fuente: asfion-web/${srcRel}
// ║   Sync con: cd ../asfion-web && npm run sync-types                        ║
// ║                                                                           ║
// ║   Si tocás este archivo a mano, el próximo sync lo pisa sin avisar.       ║
// ║   Editá el original en asfion-web y volvé a correr el sync.               ║
// ║                                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Iterar archivos: leer source, inyectar header, comparar con destino, escribir
// ─────────────────────────────────────────────────────────────────────────────
let writtenAny = false;
for (const fileRel of FILES_TO_SYNC) {
  const SOURCE = resolve(__dirname, '..', fileRel);
  const DEST   = join(APP_REPO, fileRel);

  if (!existsSync(SOURCE)) {
    console.error(`❌ Source no existe: ${SOURCE}`);
    process.exit(1);
  }

  const sourceContent  = readFileSync(SOURCE, 'utf8');
  const newDestContent = makeCopyHeader(fileRel) + sourceContent;

  // Si destino ya tiene el contenido correcto, skip (evita rebuilds Metro/Vite)
  if (existsSync(DEST)) {
    const existing = readFileSync(DEST, 'utf8');
    if (existing === newDestContent) {
      console.log(`✓ ${fileRel.split('/').pop()} ya está sincronizado`);
      continue;
    }
  }

  writeFileSync(DEST, newDestContent, 'utf8');
  console.log(`✓ Copiado ${fileRel.split('/').pop()} a ${DEST}`);
  writtenAny = true;
}

if (writtenAny) {
  console.log(`\n  Acordate de commitear los cambios en AMBOS repos.`);
} else {
  console.log(`\n  Todo ya estaba sincronizado.`);
}
