import { readFile } from 'node:fs/promises';

const files = {
  pariciones: new URL('../src/pages/ParicionesPage.tsx', import.meta.url),
  dashboard: new URL('../src/pages/Dashboard.tsx', import.meta.url),
  data: new URL('../src/data/useData.ts', import.meta.url),
  cache: new URL('../src/data/offlineCache.ts', import.meta.url),
  main: new URL('../src/main.tsx', import.meta.url),
  vite: new URL('../vite.config.ts', import.meta.url),
};

const [pariciones, dashboard, data, cache, main, vite] = await Promise.all(
  Object.values(files).map(file => readFile(file, 'utf8')),
);

const checks = [
  {
    ok: /if \(campaniaSeleccionada\.activa\)[\s\S]*camposParaKpis:\s*camposVisibles/.test(pariciones),
    message: 'La campaña activa volvió a recalcular el stock desde tactos.',
  },
  {
    ok: /const CACHE_VERSION = 8/.test(cache),
    message: 'El dashboard puede volver a aceptar un cache anterior a la corrección de stock.',
  },
  {
    ok: /setAdminClienteRequestScope\(clienteId \?\? null\)/.test(data) &&
      /setData\(null\)[\s\S]*loadCache\(cacheScope\)/.test(data),
    message: 'El cambio de cliente puede volver a mostrar datos del tenant anterior.',
  },
  {
    ok: /loading && data && cachedAt && !offline/.test(dashboard) &&
      /Última actualización confirmada/.test(dashboard) &&
      !/return ['"]recién['"]/.test(dashboard),
    message: 'El cache volvió a presentarse como información fresca sin advertencia.',
  },
  {
    ok: /controllerchange/.test(main) && /window\.location\.reload\(\)/.test(main),
    message: 'La PWA puede conservar una versión vieja después de publicar.',
  },
  {
    ok: /navigateFallbackDenylist:[\s\S]*supabase/.test(vite),
    message: 'El service worker puede volver a interceptar respuestas de Supabase.',
  },
];

const failed = checks.filter(check => !check.ok);
if (failed.length > 0) {
  failed.forEach(check => console.error(`✗ ${check.message}`));
  process.exit(1);
}

console.log('✓ Regresiones críticas verificadas: stock oficial, aislamiento, cache, actualización y PWA.');
