import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore: vite-plugin-pwa se instala con `npm install` después de
// agregarlo a package.json. El @ts-ignore evita warnings en sandboxes
// donde npm install todavía no corrió.
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    // PWA: convierte el dashboard en una aplicación instalable + offline.
    //
    // Strategy:
    //   - registerType 'autoUpdate' → service worker se actualiza solo
    //     al detectar versión nueva (no requiere intervención del user).
    //   - workbox precachea TODO el bundle JS/CSS/HTML al primer load
    //     online, así la próxima vez sin internet la app abre igual.
    //   - Para los datos de Supabase NO usamos cache HTTP del SW (porque
    //     las queries son POST a una endpoint con auth y los queries son
    //     dinámicos). En su lugar usamos IndexedDB manual desde useData.ts.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'asfion-logo.svg', 'asfion-logo-on-dark.svg'],
      manifest: {
        name: 'ASFION Dashboard',
        short_name: 'ASFION',
        description: 'Tablero ASFION — gestión ganadera con cache offline.',
        theme_color: '#0D2939',
        background_color: '#F8F6F1',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // No interceptamos llamadas a Supabase desde el SW — la app
        // hace su propio cache de data en IndexedDB.
        navigateFallbackDenylist: [/^\/api/, /^https:\/\/.*\.supabase\.co/],
        // Maximum file size para precache — los chunks de leaflet/recharts
        // pueden ser grandes. 5MB es razonable.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        // No habilitamos el SW en dev — solo en build. Evita confusión
        // cuando recargás cambios y el SW sirve la versión vieja.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // @supabase/storage-js@2.106+ importa "iceberg-js" en el top (feature
      // de analytics buckets). El dashboard no usa Storage en absoluto,
      // así que aliaseamos a un shim vacío para no tener que instalar la
      // dep ni inflar el bundle. Ver src/lib/iceberg-shim.ts.
      'iceberg-js': path.resolve(__dirname, './src/lib/iceberg-shim.ts'),
    },
  },
  // Excluimos storage-js de optimizeDeps por las dudas — si Vite lo
  // pre-bundlea, puede ignorar el alias durante el dev server.
  optimizeDeps: {
    exclude: ['@supabase/storage-js'],
  },
  server: { port: 5173, open: true },
});
