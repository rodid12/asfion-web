import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
    plugins: [react()],
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
