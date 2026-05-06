import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/raco/', // <-- AQUÍ ESTÁ LA LÍNEA NUEVA
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      // Subimos el aviso a 700 kB y sacamos las libs grandes a chunks separados
      // para mejorar la carga inicial y aprovechar caché del navegador.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor':   ['react', 'react-dom', 'react-router-dom'],
            'supabase':       ['@supabase/supabase-js'],
            'firebase':       ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'charts':         ['recharts'],
            'motion':         ['motion', 'framer-motion'],
            'ai':             ['@google/genai'],
            'icons':          ['lucide-react'],
            'xlsx':           ['xlsx'],
          },
        },
      },
    },
  };
});
