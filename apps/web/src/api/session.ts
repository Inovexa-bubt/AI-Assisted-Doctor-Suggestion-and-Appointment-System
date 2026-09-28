import type { Patient, StaffUser } from '@inovexa/shared'
import { useQuery } from '@tanstack/react-query'
import { ApiRequestError } from './client.ts'
import { api } from './endpoints.ts'

const nullIf401 = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 401) return null
    throw e
  }
}

/** The signed-in patient, or null. */
export function usePatient() {
  return useQuery<Patient | null>({
    queryKey: ['me'],
    queryFn: () => nullIf401(api.me),
    staleTime: 5 * 60_000,
  })
}

/** The signed-in staff member, or null. */
export function useStaffUser() {
  return useQuery<StaffUser | null>({
    queryKey: ['staff-me'],
    queryFn: () => nullIf401(api.staffMe),
    staleTime: 5 * 60_000,
  })
}
