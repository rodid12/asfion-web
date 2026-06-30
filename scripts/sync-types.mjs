#!/usr/bin/env node
// =============================================================================
// sync-types.mjs — Sincroniza archivos canonical entre asfion-web y asfion-app
// =============================================================================
//
// Copia los archivos canonical del repo web al repo app, agregando un header
// de "no editar" para que sea obvio en el destination.
//
// Uso:
//   npm run sync-types              (escribir/actualizar copias)
//   npm run sync-types -- --check   (modo dry-run para CI)
//
// MODO --check: NO escribe nada. Compara source vs dest y termina con
// exit code 1 si están desincronizados. Apto para CI/pre-commit:
//
//   - exit 0 → todo en sync, OK para mergear
//   - exit 1 → diff detectado, mostrar al dev qué corre `npm run sync-types`
//
// Asume que asfion-app está al lado de asfion-web en el filesystem:
//   parent/
//     asfion-web/    ← lo corrés desde acá
//     asfion-app/    ← copia el archivo acá
//
// Si tu layout es distinto, pasalo como arg:
//   node scripts/sync-types.mjs /path/al/asfion-app
//   node scripts/sync-types.mjs /path/al/asfion-app --check
//
// EXIT CODES:
//   0 — sin escribir (write mode) o todo sync (check mode)
//   1 — error de I/O (no encuentra el destino, sin permisos, etc.) o desync (check)
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Parse args — modo, path del app repo
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isCheckMode = args.includes('--check');
const appRepoArg = args.find(a => !a.startsWith('--'));

// Path al repo app — primer arg (no-flag) de CLI o asume sibling directory
const APP_REPO = appRepoArg
  ? resolve(appRepoArg)
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
// Iterar archivos: leer source, inyectar header, comparar con destino
// En modo --check solo reporta diffs. En modo normal, escribe.
// ─────────────────────────────────────────────────────────────────────────────
let writtenAny = false;
const outOfSync = [];

for (const fileRel of FILES_TO_SYNC) {
  const SOURCE = resolve(__dirname, '..', fileRel);
  const DEST   = join(APP_REPO, fileRel);

  if (!existsSync(SOURCE)) {
    console.error(`❌ Source no existe: ${SOURCE}`);
    process.exit(1);
  }

  const sourceContent  = readFileSync(SOURCE, 'utf8');
  const newDestContent = makeCopyHeader(fileRel) + sourceContent;

  const destExists = existsSync(DEST);
  const existing   = destExists ? readFileSync(DEST, 'utf8') : null;
  const inSync     = existing === newDestContent;

  if (inSync) {
    console.log(`✓ ${fileRel.split('/').pop()} ya está sincronizado`);
    continue;
  }

  if (isCheckMode) {
    outOfSync.push(fileRel);
    console.error(
      destExists
        ? `✗ ${fileRel.split('/').pop()} — DESINCRONIZADO`
        : `✗ ${fileRel.split('/').pop()} — NO EXISTE en el app`,
    );
    continue;
  }

  writeFileSync(DEST, newDestContent, 'utf8');
  console.log(`✓ Copiado ${fileRel.split('/').pop()} a ${DEST}`);
  writtenAny = true;
}

if (isCheckMode) {
  if (outOfSync.length > 0) {
    console.error(`\n❌ ${outOfSync.length} archivo(s) desincronizado(s).`);
    console.error(`   Corré desde asfion-web: \`npm run sync-types\``);
    console.error(`   Después commiteá los cambios en ambos repos.`);
    process.exit(1);
  }
  console.log(`\n✓ Todos los archivos canonical están sincronizados.`);
  process.exit(0);
}

if (writtenAny) {
  console.log(`\n  Acordate de commitear los cambios en AMBOS repos.`);
} else {
  console.log(`\n  Todo ya estaba sincronizado.`);
}
