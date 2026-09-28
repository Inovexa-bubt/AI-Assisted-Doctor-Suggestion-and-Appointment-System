import { expect, test } from '@playwright/test'
import { bookFirstOpenSlot, freshStart, signInWithPhone } from './helpers.ts'

test.beforeEach(async ({ page }) => freshStart(page))

test('a new patient finds a doctor, books, reschedules and cancels', async ({ page }, info) => {
  const phone = info.project.name === 'mobile' ? '01811000002' : '01811000001'

  await page.goto('/doctors?specialty=cardiology')
  await expect(page.getByText(/\d+ doctors?/)).toBeVisible()
  await page.getByRole('link', { name: 'See slots' }).first().click()
  await expect(page.getByRole('heading', { name: 'Choose a slot' })).toBeVisible()

  await bookFirstOpenSlot(page)
  await signInWithPhone(page, phone)

  // Held for 5 minutes, then confirmed.
  await expect(page.getByRole('heading', { name: 'Confirm your appointment' })).toBeVisible()
  await expect(page.getByRole('timer')).toContainText(/Slot held for you for [45]:\d\d/)
  await page.getByRole('button', { name: 'Confirm booking' }).click()
  await expect(page.getByRole('heading', { name: 'You’re booked' })).toBeVisible()
  await expect(page.getByText('We sent the details to 01811-00000')).toBeVisible()

  // Reschedule to another slot.
  await page.getByRole('link', { name: 'My appointments' }).last().click()
  await expect(page.getByText('Booked', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Reschedule' }).click()
  await expect(page.getByText(/Choose a new slot for your appointment/)).toBeVisible()
  await page.locator('[role=tabpanel] button:not([disabled])').nth(1).click()
  await page.getByRole('button', { name: 'Book this slot' }).click()
  await expect(page.getByText(/Moving from/)).toBeVisible()
  await page.getByRole('button', { name: 'Confirm booking' }).click()
  await expect(page.getByRole('heading', { name: 'Your appointment has been moved' })).toBeVisible()

  // Cancel it.
  await page.goto('/appointments')
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, cancel' }).click()
  await expect(page.getByText('You have no upcoming appointments.')).toBeVisible()
  await page.getByRole('radio', { name: 'Past and cancelled' }).click()
  await expect(page.getByText('Cancelled by you')).toBeVisible()
  await expect(page.getByText('Moved to another slot')).toBeVisible()
})

test('changing the slot releases the hold', async ({ page }) => {
  await page.goto('/doctors/d02')
  await bookFirstOpenSlot(page)
  await signInWithPhone(page, '01811000003')
  await expect(page.getByRole('heading', { name: 'Confirm your appointment' })).toBeVisible()
  await page.getByRole('button', { name: 'Change slot' }).click()
  await expect(page).toHaveURL(/\/doctors\/d02$/)
  await expect(page.locator('[role=tabpanel] button:not([disabled])').first()).toBeVisible()
})
