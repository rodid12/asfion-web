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

const SOURCE = resolve(__dirname, '../src/data/types.canonical.ts');

// Path al repo app — primer arg de CLI o asume sibling directory
const APP_REPO = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(__dirname, '../../asfion-app');
const DEST = join(APP_REPO, 'src/data/types.canonical.ts');

// ─────────────────────────────────────────────────────────────────────────────
// Sanity checks
// ─────────────────────────────────────────────────────────────────────────────
if (!existsSync(SOURCE)) {
  console.error(`❌ Source no existe: ${SOURCE}`);
  process.exit(1);
}
if (!existsSync(APP_REPO)) {
  console.error(`❌ Repo app no encontrado: ${APP_REPO}`);
  console.error(`   Pasalo como argumento: node scripts/sync-types.mjs /path/al/asfion-app`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Header que se inyecta en el destino
// ─────────────────────────────────────────────────────────────────────────────
const COPY_HEADER = `// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                                                                           ║
// ║   ⚠️  ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR                          ║
// ║                                                                           ║
// ║   Fuente: asfion-web/src/data/types.canonical.ts                          ║
// ║   Sync con: cd ../asfion-web && npm run sync-types                        ║
// ║                                                                           ║
// ║   Si tocás este archivo a mano, el próximo sync lo pisa sin avisar.       ║
// ║   Editá el original en asfion-web y volvé a correr el sync.               ║
// ║                                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

`;

// ─────────────────────────────────────────────────────────────────────────────
// Leer source, inyectar header, escribir destino
// ─────────────────────────────────────────────────────────────────────────────
const sourceContent = readFileSync(SOURCE, 'utf8');
const newDestContent = COPY_HEADER + sourceContent;

// Si el destino existe y ya tiene el contenido correcto, no escribimos
// (evita tocar mtime y trigger rebuilds innecesarios de Metro/Vite).
if (existsSync(DEST)) {
  const existing = readFileSync(DEST, 'utf8');
  if (existing === newDestContent) {
    console.log(`✓ types.canonical.ts ya está sincronizado en asfion-app`);
    process.exit(0);
  }
}

writeFileSync(DEST, newDestContent, 'utf8');
console.log(`✓ Copiado a ${DEST}`);
console.log(`  Acordate de commitear el cambio en AMBOS repos.`);
