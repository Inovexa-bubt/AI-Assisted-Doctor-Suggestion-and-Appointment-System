import { type Page, expect } from '@playwright/test'

/** Starts every test from fresh demo data in English. */
export async function freshStart(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-started')) {
      localStorage.clear()
      localStorage.setItem('lumina:lang', 'en')
      sessionStorage.setItem('e2e-started', '1')
    }
  })
}

/** Signs in with a phone number on the sign-in page, registering if needed. */
export async function signInWithPhone(page: Page, phone: string, name = 'Test Patient') {
  await expect(page.getByRole('heading', { name: 'Sign in with your phone' })).toBeVisible()
  await page.getByLabel('Mobile number').fill(phone)
  await page.getByRole('button', { name: 'Send code' }).click()
  const demo = page.getByText(/Demo: your code is \d{6}/)
  await expect(demo).toBeVisible()
  const code = (await demo.textContent())!.match(/\d{6}/)![0]
  await page.getByLabel('6-digit code').fill(code)
  await page.getByRole('button', { name: 'Verify' }).click()
  // Either a new patient is asked to register, or an existing one leaves the sign-in page.
  const profile = page.getByRole('heading', { name: 'About the patient' })
  await Promise.race([
    profile.waitFor({ state: 'visible' }),
    page.waitForURL((url) => !url.pathname.startsWith('/login')),
  ])
  if (await profile.isVisible()) {
    await page.getByLabel('Full name').fill(name)
    await page.getByLabel('Age').fill('35')
    await page.getByRole('button', { name: 'Finish registration' }).click()
  }
}

/** Picks the first open slot on a doctor's page and presses "Book this slot". */
export async function bookFirstOpenSlot(page: Page) {
  await page.locator('[role=tabpanel] button:not([disabled])').first().click()
  await page.getByRole('button', { name: 'Book this slot' }).click()
}
