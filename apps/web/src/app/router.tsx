import { type ComponentType, type LazyExoticComponent, Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router'
import { PublicLayout, StaffLayout } from '../components/layout.tsx'
import { Spinner } from '../components/ui.tsx'
import Home from '../pages/Home.tsx'
import NotFound from '../pages/NotFound.tsx'
import RouteError from '../pages/RouteError.tsx'
import { RequirePatient, RequireStaff, StaffHome } from './guards.tsx'

const page = (Page: LazyExoticComponent<ComponentType>) => (
  <Suspense fallback={<Spinner />}>
    <Page />
  </Suspense>
)

const Assistant = lazy(() => import('../pages/Assistant.tsx'))
const Doctors = lazy(() => import('../pages/Doctors.tsx'))
const DoctorProfile = lazy(() => import('../pages/DoctorProfile.tsx'))
const Login = lazy(() => import('../pages/Login.tsx'))
const Book = lazy(() => import('../pages/Book.tsx'))
const BookingConfirm = lazy(() => import('../pages/BookingConfirm.tsx'))
const BookingDone = lazy(() => import('../pages/BookingDone.tsx'))
const MyAppointments = lazy(() => import('../pages/MyAppointments.tsx'))
const LiveQueue = lazy(() => import('../pages/LiveQueue.tsx'))

const StaffLogin = lazy(() => import('../pages/staff/StaffLogin.tsx'))
const FrontDesk = lazy(() => import('../pages/staff/FrontDesk.tsx'))
const DoctorView = lazy(() => import('../pages/staff/DoctorView.tsx'))
const Analytics = lazy(() => import('../pages/staff/Analytics.tsx'))
const AdminDoctors = lazy(() => import('../pages/staff/admin/Doctors.tsx'))
const AdminDoctorEdit = lazy(() => import('../pages/staff/admin/DoctorEdit.tsx'))
const AdminLeave = lazy(() => import('../pages/staff/admin/LeaveDays.tsx'))
const AdminSpecialties = lazy(() => import('../pages/staff/admin/Specialties.tsx'))
const AdminSettings = lazy(() => import('../pages/staff/admin/Settings.tsx'))
const AdminSms = lazy(() => import('../pages/staff/admin/SmsLog.tsx'))
const AdminAccounts = lazy(() => import('../pages/staff/admin/Accounts.tsx'))

const patientOnly = (Page: LazyExoticComponent<ComponentType>) => (
  <RequirePatient>{page(Page)}</RequirePatient>
)

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: 'assistant', element: page(Assistant) },
      { path: 'doctors', element: page(Doctors) },
      { path: 'doctors/:id', element: page(DoctorProfile) },
      { path: 'login', element: page(Login) },
      { path: 'book', element: patientOnly(Book) },
      { path: 'booking/:id', element: patientOnly(BookingConfirm) },
      { path: 'booking/:id/done', element: patientOnly(BookingDone) },
      { path: 'appointments', element: patientOnly(MyAppointments) },
      { path: 'appointments/:id/queue', element: patientOnly(LiveQueue) },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: 'staff/login', element: page(StaffLogin), errorElement: <RouteError /> },
  {
    path: 'staff',
    element: (
      <RequireStaff>
        <StaffLayout />
      </RequireStaff>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <StaffHome /> },
      {
        path: 'front-desk',
        element: <RequireStaff roles={['front_desk', 'admin']}>{page(FrontDesk)}</RequireStaff>,
      },
      {
        path: 'doctor',
        element: <RequireStaff roles={['doctor']}>{page(DoctorView)}</RequireStaff>,
      },
      {
        path: 'analytics',
        element: <RequireStaff roles={['admin']}>{page(Analytics)}</RequireStaff>,
      },
      {
        path: 'admin/doctors',
        element: <RequireStaff roles={['admin']}>{page(AdminDoctors)}</RequireStaff>,
      },
      {
        path: 'admin/doctors/new',
        element: <RequireStaff roles={['admin']}>{page(AdminDoctorEdit)}</RequireStaff>,
      },
      {
        path: 'admin/doctors/:id',
        element: <RequireStaff roles={['admin']}>{page(AdminDoctorEdit)}</RequireStaff>,
      },
      {
        path: 'admin/leave',
        element: <RequireStaff roles={['admin']}>{page(AdminLeave)}</RequireStaff>,
      },
      {
        path: 'admin/specialties',
        element: <RequireStaff roles={['admin']}>{page(AdminSpecialties)}</RequireStaff>,
      },
      {
        path: 'admin/settings',
        element: <RequireStaff roles={['admin']}>{page(AdminSettings)}</RequireStaff>,
      },
      {
        path: 'admin/sms',
        element: <RequireStaff roles={['admin']}>{page(AdminSms)}</RequireStaff>,
      },
      {
        path: 'admin/accounts',
        element: <RequireStaff roles={['admin']}>{page(AdminAccounts)}</RequireStaff>,
      },
    ],
  },
])
