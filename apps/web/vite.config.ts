import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Test files and Playwright output are not part of the app; changes to them must not
    // reload pages that are open (including pages under test).
    watch: { ignored: ['**/e2e/**', '**/test-results/**', '**/playwright-report/**'] },
  },
})
