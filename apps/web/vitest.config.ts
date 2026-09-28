import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Mock-backend tests run in Node; component tests opt into jsdom with a file comment.
    environment: 'node',
  },
})
