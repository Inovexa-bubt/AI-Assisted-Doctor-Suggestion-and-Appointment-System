import type { Server as HttpServer } from 'node:http'
import { Server as SocketIOServer } from 'socket.io'

export interface QueueBroadcaster {
  attach?(httpServer: HttpServer, corsOrigin: string): void
  emitQueueChanged(doctorId: string, date: string, nowServing: number | null): void
  close(): Promise<void>
}

export function roomName(doctorId: string, date: string): string {
  return `queue:${doctorId}:${date}`
}

/**
 * Socket.IO queue hub. Call `attach(httpServer, corsOrigin)` AFTER creating `httpServer` with the
 * Express `app` (`createServer(app)`) so Socket.IO intercepts `/socket.io` cleanly before Express.
 */
export function createQueueHub(httpServer?: HttpServer, corsOrigin = '*'): QueueBroadcaster {
  let io: SocketIOServer | null = null

  const attach = (server: HttpServer, origin: string) => {
    io = new SocketIOServer(server, {
      path: '/socket.io',
      cors: {
        origin: origin ? origin.split(',').map((s) => s.trim()) : true,
        credentials: true,
      },
    })

    io.on('connection', (socket) => {
      socket.on('queue:join', (payload: { doctorId?: unknown; date?: unknown }) => {
        const doctorId = typeof payload?.doctorId === 'string' ? payload.doctorId : ''
        const date = typeof payload?.date === 'string' ? payload.date : ''
        if (doctorId && date) {
          void socket.join(roomName(doctorId, date))
        }
      })

      socket.on('queue:leave', (payload: { doctorId?: unknown; date?: unknown }) => {
        const doctorId = typeof payload?.doctorId === 'string' ? payload.doctorId : ''
        const date = typeof payload?.date === 'string' ? payload.date : ''
        if (doctorId && date) {
          void socket.leave(roomName(doctorId, date))
        }
      })
    })
  }

  if (httpServer) attach(httpServer, corsOrigin)

  return {
    attach,
    emitQueueChanged(doctorId: string, date: string, nowServing: number | null) {
      // Events carry NO patient data — clients refetch over REST, which checks permissions.
      io?.to(roomName(doctorId, date)).emit('queue:changed', { doctorId, date, nowServing })
    },
    async close() {
      if (!io) return
      const current = io
      io = null
      await new Promise<void>((resolve) => {
        current.close(() => resolve())
      })
    },
  }
}

export function createNoopBroadcaster(
  onEmit?: (doctorId: string, date: string, nowServing: number | null) => void,
): QueueBroadcaster {
  return {
    emitQueueChanged(doctorId, date, nowServing) {
      onEmit?.(doctorId, date, nowServing)
    },
    async close() {},
  }
}
