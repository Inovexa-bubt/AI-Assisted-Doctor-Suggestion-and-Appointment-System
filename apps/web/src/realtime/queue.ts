// Live queue notifications. The events carry no patient data: listeners refetch over the API.
//
// Milestone 1: the mock API publishes changes here, and a BroadcastChannel carries them to other
// tabs. With the real backend this module joins the Socket.IO room `queue:{doctorId}:{date}`
// (docs/design/api.md, "Realtime") and calls the same listeners.

export interface QueueChange {
  doctorId: string
  date: string
}

type Listener = (change: QueueChange | null) => void

const listeners = new Set<Listener>()
const channel =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('lumina-queue')

function emit(change: QueueChange | null) {
  for (const listener of listeners) listener(change)
}

channel?.addEventListener('message', (e: MessageEvent<QueueChange>) => emit(e.data))

export function publishQueueChange(doctorId: string, date: string) {
  const change = { doctorId, date }
  channel?.postMessage(change)
  emit(change)
}

/** Tells every listener that anything may have changed (e.g. another tab edited the data). */
export function publishEverythingChanged() {
  emit(null)
}

export function subscribeQueue(doctorId: string, date: string, onChange: () => void): () => void {
  const listener: Listener = (change) => {
    if (!change || (change.doctorId === doctorId && change.date === date)) onChange()
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}
