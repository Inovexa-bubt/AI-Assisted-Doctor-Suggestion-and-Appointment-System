import '@fontsource-variable/inter'
import '@fontsource/hind-siliguri/bengali-400.css'
import '@fontsource/hind-siliguri/bengali-500.css'
import '@fontsource/hind-siliguri/bengali-600.css'
import './index.css'
import './i18n/index.ts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { ApiRequestError } from './api/client.ts'
import { DemoProvider } from './app/demo.tsx'
import { router } from './app/router.tsx'
import type { MockDb } from './mocks/db.ts'
import { publishEverythingChanged } from './realtime/queue.ts'

async function boot() {
  // Milestone 1: answer /api/v1 in the browser from sample data (VITE_API_MOCK=false turns it off).
  let db: MockDb | null = null
  if (import.meta.env.VITE_API_MOCK !== 'false') {
    const { startMockApi } = await import('./mocks/browser.ts')
    db = await startMockApi()
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Client errors (4xx) will not fix themselves; retry only network and server errors.
        retry: (count, error) =>
          count < 2 &&
          !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500),
      },
    },
  })

  // Another tab changed the demo data: refresh everything on screen.
  db?.onExternalChange(() => {
    void queryClient.invalidateQueries()
    publishEverythingChanged()
  })

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <DemoProvider db={db}>
          <RouterProvider router={router} />
        </DemoProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

void boot()
