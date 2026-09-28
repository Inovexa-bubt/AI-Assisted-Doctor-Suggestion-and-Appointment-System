import { setupWorker } from 'msw/browser'
import { publishQueueChange } from '../realtime/queue.ts'
import { MockBackend } from './backend.ts'
import { MockDb } from './db.ts'
import { createHandlers } from './handlers.ts'

/** Starts the in-browser mock API and returns its database (for the demo reset button). */
export async function startMockApi(): Promise<MockDb> {
  const db = new MockDb()
  const backend = new MockBackend(db, { onQueueChanged: publishQueueChange })
  const worker = setupWorker(...createHandlers(backend))
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  return db
}
