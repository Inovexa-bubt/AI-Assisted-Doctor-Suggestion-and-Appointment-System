import type { StaffRole } from '@inovexa/shared'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { usePatient, useStaffUser } from '../api/session.ts'
import { ErrorState, Spinner } from '../components/ui.tsx'

const here = (location: { pathname: string; search: string }) =>
  encodeURIComponent(location.pathname + location.search)

/** Sends visitors who are not signed in to the phone sign-in, then back here. */
export function RequirePatient({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { data: patient, isPending, error, refetch } = usePatient()
  if (isPending) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (!patient) return <Navigate to={`/login?next=${here(location)}`} replace />
  return children
}

export const STAFF_HOME: Record<StaffRole, string> = {
  admin: '/staff/analytics',
  front_desk: '/staff/front-desk',
  doctor: '/staff/doctor',
}

export function RequireStaff({ roles, children }: { roles?: StaffRole[]; children: ReactNode }) {
  const location = useLocation()
  const { data: user, isPending, error, refetch } = useStaffUser()
  if (isPending) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (!user) return <Navigate to={`/staff/login?next=${here(location)}`} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={STAFF_HOME[user.role]} replace />
  return children
}

export function StaffHome() {
  const { data: user } = useStaffUser()
  return user ? <Navigate to={STAFF_HOME[user.role]} replace /> : null
}
