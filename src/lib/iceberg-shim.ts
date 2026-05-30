// Shim vacío para `iceberg-js`.
//
// @supabase/storage-js@2.106+ hace `import { IcebergRestCatalog } from
// "iceberg-js"` en el top. Es una dep dura aunque solo se usa cuando
// llamás analyticBucket.iceberg(), feature que el dashboard NO usa.
//
// Aliaseamos el package a este shim desde vite.config.ts → evitamos:
//   - instalar la dep (~1 MB en node_modules)
//   - bundlear código que nunca corre
//
// Si en el futuro el dashboard expone Storage analytics, instalar
// iceberg-js (`npm install iceberg-js`) y borrar el alias.

export class IcebergRestCatalog {
  constructor() {
    throw new Error(
      'iceberg-js shim: este build del dashboard no incluye soporte de Iceberg storage. ' +
      'Si necesitás esta feature, instalá iceberg-js y borrá el alias de vite.config.ts.',
    );
  }
}

export class IcebergError extends Error {}

// Re-export por si storage-js importa algo más del namespace.
export default { IcebergRestCatalog, IcebergError };
