import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, createContext, use } from 'react'
import type { MockDb } from '../mocks/db.ts'

const DemoContext = createContext<MockDb | null>(null)

export function DemoProvider({ db, children }: { db: MockDb | null; children: ReactNode }) {
  return <DemoContext value={db}>{children}</DemoContext>
}

/** In mock mode: whether the demo is running and how to reset its data. */
export function useDemo() {
  const db = use(DemoContext)
  const queryClient = useQueryClient()
  return {
    isDemo: db !== null,
    reset: () => {
      if (!db) return
      db.reset()
      for (const name of ['sid', 'staff_sid']) document.cookie = `${name}=; Path=/; Max-Age=0`
      queryClient.clear()
    },
  }
}
