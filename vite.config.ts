import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Os testes de navegador (Playwright) rodam à parte: npm run test:e2e.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Valores falsos: os testes nunca falam com o Supabase de verdade.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'chave-de-teste',
    },
  },
})
