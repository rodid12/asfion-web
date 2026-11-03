import { readFile } from 'node:fs/promises';

const files = {
  pariciones: new URL('../src/pages/ParicionesPage.tsx', import.meta.url),
  dashboard: new URL('../src/pages/Dashboard.tsx', import.meta.url),
  data: new URL('../src/data/useData.ts', import.meta.url),
  cache: new URL('../src/data/offlineCache.ts', import.meta.url),
  main: new URL('../src/main.tsx', import.meta.url),
  vite: new URL('../vite.config.ts', import.meta.url),
  mortandad: new URL('../src/pages/MortandadPage.tsx', import.meta.url),
  kpis: new URL('../src/components/pariciones/computeKpisLegacy.ts', import.meta.url),
  workbook: new URL('../src/lib/exportWorkbook.ts', import.meta.url),
  mermas: new URL('../src/components/pariciones/MermasPariciones.tsx', import.meta.url),
};

const [pariciones, dashboard, data, cache, main, vite, mortandad, kpis, workbook, mermas] = await Promise.all(
  Object.values(files).map(file => readFile(file, 'utf8')),
);

const checks = [
  {
    ok: /if \(campaniaSeleccionada\.activa\)[\s\S]*camposParaKpis:\s*camposVisibles/.test(pariciones),
    message: 'La campaña activa volvió a recalcular el stock desde tactos.',
  },
  {
    ok: /const CACHE_VERSION = 9/.test(cache),
    message: 'El dashboard puede volver a aceptar un cache anterior a la corrección de stock.',
  },
  {
    ok: /setAdminClienteRequestScope\(clienteId \?\? null\)/.test(data) &&
      /setData\(null\)[\s\S]*loadCache\(cacheScope\)/.test(data) &&
      /const refresh = useCallback/.test(data) &&
      /revalidacionSilenciosa = nonce > 0 && mismoScope && data !== null/.test(data) &&
      /revalidacionSilenciosa \? null : await loadCache/.test(data),
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
  {
    ok: /if \(ev === ['"]RETACTO['"]\) retactosIds\.add\(p\.id\)/.test(kpis) &&
      /retactos,/.test(kpis),
    message: 'Retacto volvió a quedar fijo en cero en las métricas.',
  },
  {
    ok: /todosEventosIds\.add\(p\.id\)/.test(kpis) &&
      /const totalEventos\s*=\s*todosEventosIds\.size/.test(kpis) &&
      /eventos:\s*totalEventos/.test(kpis),
    message: 'El KPI Eventos volvió a contar solo nacimientos y dejó afuera las muertes/abortos/retactos.',
  },
  {
    ok: /origen: ['"]Mortandad['"]/.test(mortandad) &&
      /origen: ['"]Pariciones['"]/.test(mortandad) &&
      /\.filter\(p => p\.evento === ['"]Muerte['"]\)/.test(mortandad) &&
      /actividadFiltro/.test(mortandad) && /categoriaFiltro/.test(mortandad),
    message: 'Mortandad perdió la vista consolidada o sus filtros operativos.',
  },
  {
    ok: /Exportar Excel completo/.test(dashboard) &&
      /buildDashboardWorkbookBytes/.test(workbook) &&
      /0x04034b50/.test(workbook) && /0x06054b50/.test(workbook) &&
      /Preñez - Tactos/.test(workbook) && /Resumen Pariciones/.test(workbook),
    message: 'Se perdió el Excel consolidado o alguna de sus hojas críticas.',
  },
  {
    ok: /<MermasPariciones data=\{filtrados\}/.test(pariciones) &&
      /title="Mermas"/.test(mermas) && /Retacto/.test(mermas) &&
      /Nacido muerto/.test(mermas) && /Muerte señalado/.test(mermas) &&
      /Math\.floor\(orejano\.size \/ 2\)/.test(mermas) && /Orejano \(÷2\)/.test(mermas),
    message: 'El dashboard perdió el desglose de mermas reproductivas.',
  },
  {
    ok: /p\.campaniaId === reproductivaSeleccionada\.id/.test(dashboard) &&
      /ModulePane active=\{modulo === 'mortandad'\}/.test(dashboard) &&
      /visibilitychange/.test(dashboard) && /window\.addEventListener\('focus'/.test(dashboard),
    message: 'El dashboard volvió a perder filtros entre pestañas o dejó de refrescar datos al recuperar foco.',
  },
  {
    ok: /comparable\.includes\('desconoc'\)/.test(mortandad) &&
      /comparable\.includes\('infec'\)/.test(mortandad),
    message: 'Mortandad dejó de agrupar variantes de causas equivalentes.',
  },
];

const failed = checks.filter(check => !check.ok);
if (failed.length > 0) {
  failed.forEach(check => console.error(`✗ ${check.message}`));
  process.exit(1);
}

console.log('✓ Regresiones críticas verificadas: stock oficial, aislamiento, cache, actualización y PWA.');
