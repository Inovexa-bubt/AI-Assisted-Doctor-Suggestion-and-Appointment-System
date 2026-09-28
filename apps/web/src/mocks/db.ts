// In-browser database for the mock API.
//
// The day's base data comes from the seeded generator in @inovexa/shared, so it is rebuilt on
// every page load instead of stored (it is several megabytes). Only the demo's own changes are
// saved, as a small overlay in localStorage. Another tab's changes arrive through the `storage`
// event, so two tabs (say, front desk and patient) see the same data.

import {
  type Appointment,
  type Doctor,
  type LeaveDay,
  type Patient,
  type QueueRecord,
  type SampleData,
  type Settings,
  type SmsMessage,
  type Specialty,
  type StaffAccount,
  type QuestionKind,
  type TriageRecord,
  dhakaDate,
  generateSampleData,
} from '@inovexa/shared'

export interface SessionRecord {
  id: string
  kind: 'patient' | 'staff'
  /** Patient or staff user ID. Empty for a verified phone that has not finished registering. */
  subjectId: string
  phone?: string
}

export interface OtpRecord {
  /** The phone number. */
  id: string
  code: string
  expiresAt: string
  attempts: number
}

export interface Collections {
  specialties: Specialty
  doctors: Doctor
  leaveDays: LeaveDay
  patients: Patient
  appointments: Appointment
  triage: TriageRecord & { pendingKind?: QuestionKind }
  staff: StaffAccount
  queue: QueueRecord & { id: string }
  sms: SmsMessage
  sessions: SessionRecord
  otps: OtpRecord
  settings: Settings & { id: 'settings' }
}

export type CollectionName = keyof Collections

const COLLECTIONS: CollectionName[] = [
  'specialties',
  'doctors',
  'leaveDays',
  'patients',
  'appointments',
  'triage',
  'staff',
  'queue',
  'sms',
  'sessions',
  'otps',
  'settings',
]

interface Overlay {
  version: 1
  /** When the base data was generated; the same instant regenerates the same base. */
  generatedAt: string
  puts: { [K in CollectionName]?: Record<string, Collections[K]> }
  removes: { [K in CollectionName]?: string[] }
}

export const STORAGE_KEY = 'lumina-demo:overlay'

export const queueId = (doctorId: string, date: string) => `${doctorId}|${date}`

function toTables(data: SampleData): { [K in CollectionName]: Map<string, Collections[K]> } {
  const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]))
  return {
    specialties: byId(data.specialties),
    doctors: byId(data.doctors),
    leaveDays: byId(data.leaveDays),
    patients: byId(data.patients),
    appointments: byId(data.appointments),
    triage: byId(data.triage),
    staff: byId(data.staff),
    queue: byId(data.queue.map((q) => ({ ...q, id: queueId(q.doctorId, q.date) }))),
    sms: byId(data.sms),
    sessions: new Map(),
    otps: new Map(),
    settings: new Map([['settings', { ...data.settings, id: 'settings' as const }]]),
  }
}

function readStorage(storage: Storage | undefined): Overlay | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Overlay) : null
    return parsed?.version === 1 ? parsed : null
  } catch {
    return null
  }
}

export class MockDb {
  private tables!: { [K in CollectionName]: Map<string, Collections[K]> }
  private overlay!: Overlay
  private listeners = new Set<() => void>()
  private readonly storage: Storage | undefined
  private readonly now: () => Date

  constructor(
    storage: Storage | undefined = globalThis.localStorage,
    now: () => Date = () => new Date(),
  ) {
    this.storage = storage
    this.now = now
    this.load()
    globalThis.addEventListener?.('storage', (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      this.load()
      for (const listener of this.listeners) listener()
    })
  }

  /** Rebuilds the tables: today's base data plus the saved overlay. A new day starts fresh. */
  private load() {
    const saved = readStorage(this.storage)
    const now = this.now()
    const usable = saved && dhakaDate(new Date(saved.generatedAt)) === dhakaDate(now)
    this.overlay = usable
      ? saved
      : { version: 1, generatedAt: now.toISOString(), puts: {}, removes: {} }
    this.tables = toTables(generateSampleData({ now: new Date(this.overlay.generatedAt) }))
    for (const name of COLLECTIONS) {
      const table = this.tables[name] as Map<string, unknown>
      for (const id of this.overlay.removes[name] ?? []) table.delete(id)
      for (const [id, value] of Object.entries(this.overlay.puts[name] ?? {})) table.set(id, value)
    }
    if (!usable) this.save()
  }

  private save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.overlay))
    } catch {
      // Storage full or blocked (private mode): the demo still works for this tab.
    }
  }

  /** Called when another tab changes the data. */
  onExternalChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  all<K extends CollectionName>(name: K): Collections[K][] {
    return [...this.tables[name].values()]
  }

  get<K extends CollectionName>(name: K, id: string): Collections[K] | undefined {
    return this.tables[name].get(id)
  }

  /** Inserts or replaces a record. Records are never changed in place: always pass a new object. */
  put<K extends CollectionName>(name: K, value: Collections[K]): Collections[K] {
    this.tables[name].set(value.id, value)
    const puts = (this.overlay.puts[name] ??= {}) as Record<string, Collections[K]>
    puts[value.id] = value
    const removes = this.overlay.removes[name]
    if (removes?.includes(value.id))
      this.overlay.removes[name] = removes.filter((r) => r !== value.id)
    this.save()
    return value
  }

  remove(name: CollectionName, id: string) {
    this.tables[name].delete(id)
    delete this.overlay.puts[name]?.[id]
    ;(this.overlay.removes[name] ??= []).push(id)
    this.save()
  }

  settings(): Settings {
    return this.tables.settings.get('settings')!
  }

  /** Throws away every demo change and regenerates the data for now. */
  reset() {
    try {
      this.storage?.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    this.load()
  }
}
