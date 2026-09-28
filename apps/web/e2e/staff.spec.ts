import { addDays, dhakaDate, weekdayOf } from '@inovexa/shared'
import { type Page, expect, test } from '@playwright/test'
import { freshStart } from './helpers.ts'

test.beforeEach(async ({ page }) => freshStart(page))

/** The next date after today that falls on one of the weekdays (0 = Sunday). */
function nextChamberDate(weekdays: number[]): string {
  let date = addDays(dhakaDate(), 1)
  while (!weekdays.includes(weekdayOf(date))) date = addDays(date, 1)
  return date
}

async function staffSignIn(page: Page, role: 'Admin' | 'Front desk' | 'Doctor') {
  await expect(page.getByRole('heading', { name: 'Staff sign-in' })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${role} `) }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('front desk marks arrivals, calls the next patient and books a phone patient', async ({
  page,
}) => {
  const date = nextChamberDate([0, 2, 4]) // Dr. Mahmudul Hasan: Sun, Tue, Thu
  await page.goto(`/staff/front-desk?doctor=d01&date=${date}`)
  await staffSignIn(page, 'Front desk')
  await expect(page.getByRole('heading', { name: 'Front desk' })).toBeVisible()
  await expect(page.getByLabel('Doctor')).toHaveValue('d01')

  const list = page.getByRole('main').getByRole('listitem')
  await expect(list.first()).toBeVisible()
  const firstBooked = list.filter({ has: page.getByRole('button', { name: 'Arrived' }) }).first()
  const name = (await firstBooked.locator('p.font-semibold').first().textContent())!
    .split(' ·')[0]!
    .trim()
  await firstBooked.getByRole('button', { name: 'Arrived' }).click()
  await expect(page.getByText(/^Next: serial \d+$/)).toBeVisible()

  await page.getByRole('button', { name: 'Call next patient' }).click()
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('With the doctor')).toBeVisible()

  await page.getByRole('button', { name: 'New booking' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Patient’s mobile number').fill('01711999999')
  await dialog.getByRole('button', { name: 'Find' }).click()
  await expect(dialog.getByText('Not registered yet')).toBeVisible()
  await dialog.getByLabel('Full name').fill('Karim Uddin')
  await dialog.getByLabel('Age').fill('58')
  await dialog.getByRole('radio', { name: 'Male', exact: true }).click()
  await dialog.getByRole('radio', { name: 'By phone' }).click()
  await dialog.getByRole('button', { name: 'Book', exact: true }).click()
  await expect(page.getByText(/Booked serial \d+ for Karim Uddin\./)).toBeVisible()
  await expect(
    page.getByRole('main').getByRole('listitem').filter({ hasText: 'Karim Uddin' }),
  ).toBeVisible()
})

test('admin adds a leave day that cancels bookings and texts patients', async ({ page }) => {
  await page.goto('/staff')
  await staffSignIn(page, 'Admin')
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
  await expect(page.getByText('No-show rate')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bookings by specialty' })).toBeVisible()

  await page.getByRole('link', { name: 'Leave days' }).first().click()
  await page.getByLabel('Doctor').selectOption('d02') // Dr. Sharmin Akter: Sat, Mon, Wed
  await page.getByLabel('Date').fill(nextChamberDate([6, 1, 3]))
  const impact = page.getByText(/This cancels \d+ bookings? and texts/)
  await expect(impact).toBeVisible()
  const cancelled = (await impact.textContent())!.match(/\d+/)![0]
  await page.getByRole('button', { name: 'Add leave day' }).click()
  await expect(page.getByText(new RegExp(`Leave day added\\. ${cancelled} booking`))).toBeVisible()

  await page.getByRole('link', { name: 'SMS log' }).first().click()
  await expect(page.getByText(/Dr\. Sharmin Akter is on leave/).first()).toBeVisible()
})

test('admin changes a doctor’s fee', async ({ page }) => {
  await page.goto('/staff/admin/doctors/d02')
  await staffSignIn(page, 'Admin')
  await expect(page.getByRole('heading', { name: 'Edit doctor' })).toBeVisible()
  await page.getByLabel('Fee (BDT)').fill('850')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Doctors' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Dr\. Sharmin Akter/ })).toContainText('Tk 850')
})

test('a doctor sees only their own list, and roles are enforced', async ({ page }) => {
  await page.goto('/staff')
  await staffSignIn(page, 'Doctor')
  await expect(page.getByRole('heading', { name: 'My patients' })).toBeVisible()
  await page.goto('/staff/analytics')
  await expect(page).toHaveURL(/\/staff\/doctor$/)
})
