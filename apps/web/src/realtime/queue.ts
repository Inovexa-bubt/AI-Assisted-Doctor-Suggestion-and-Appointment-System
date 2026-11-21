// Live queue notifications. The events carry no patient data: listeners refetch over the API.
//
// In mock mode (VITE_API_MOCK !== 'false'), the mock API publishes changes here and a
// BroadcastChannel carries them across tabs. Against the real backend (VITE_API_MOCK=false),
// this module connects to Socket.IO at /socket.io and joins each doctor+date room.

import { type Socket, io } from 'socket.io-client'

export interface QueueChange {
  doctorId: string
  date: string
  nowServing?: number | null
}

type Listener = (change: QueueChange | null) => void

const USE_SOCKET = import.meta.env.VITE_API_MOCK === 'false'

const listeners = new Set<Listener>()
const channel =
  !USE_SOCKET && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('lumina-queue')
    : null

let socket: Socket | null = null
const activeRooms = new Map<string, { doctorId: string; date: string; count: number }>()

function emit(change: QueueChange | null) {
  for (const listener of listeners) listener(change)
}

channel?.addEventListener('message', (e: MessageEvent<QueueChange>) => emit(e.data))

function ensureSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', withCredentials: true })
    socket.on('connect', () => {
      for (const room of activeRooms.values()) {
        socket?.emit('queue:join', { doctorId: room.doctorId, date: room.date })
      }
    })
    socket.on('queue:changed', (payload: QueueChange) => emit(payload))
  }
  return socket
}

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

  const key = `${doctorId}|${date}`
  if (USE_SOCKET) {
    const sock = ensureSocket()
    const entry = activeRooms.get(key)
    if (entry) {
      entry.count++
    } else {
      activeRooms.set(key, { doctorId, date, count: 1 })
      sock.emit('queue:join', { doctorId, date })
    }
  }

  return () => {
    listeners.delete(listener)
    if (USE_SOCKET) {
      const entry = activeRooms.get(key)
      if (entry) {
        entry.count--
        if (entry.count <= 0) {
          activeRooms.delete(key)
          socket?.emit('queue:leave', { doctorId, date })
        }
      }
    }
  }
}
