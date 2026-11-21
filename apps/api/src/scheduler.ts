import type { HospitalService } from './services/hospital.ts'

export interface SchedulerHandle {
  stop(): void
}

export function startScheduler(service: HospitalService): SchedulerHandle {
  const minuteTimer = setInterval(() => {
    void service.clearExpiredHolds().catch((err) => {
      console.error('[scheduler] clearExpiredHolds error:', err)
    })
    void service.sendDueReminders().catch((err) => {
      console.error('[scheduler] sendDueReminders error:', err)
    })
  }, 60_000)

  const hourlyTimer = setInterval(() => {
    void service.cleanupExpiredAuth().catch((err) => {
      console.error('[scheduler] cleanupExpiredAuth error:', err)
    })
  }, 60 * 60_000)

  minuteTimer.unref()
  hourlyTimer.unref()

  return {
    stop() {
      clearInterval(minuteTimer)
      clearInterval(hourlyTimer)
    },
  }
}
