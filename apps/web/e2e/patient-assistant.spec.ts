import { expect, test } from '@playwright/test'
import { freshStart, signInWithPhone } from './helpers.ts'

test.beforeEach(async ({ page }) => freshStart(page))

test('emergency symptoms show only the emergency notice', async ({ page }) => {
  await page.goto('/assistant')
  await page.getByRole('textbox').fill('My father has chest pain since morning')
  await page.getByRole('button', { name: 'Send' }).click()
  const notice = page.getByRole('alert').filter({ hasText: 'This may be an emergency' })
  await expect(notice).toBeVisible()
  await expect(notice.getByRole('link', { name: 'Call 999' })).toHaveAttribute('href', 'tel:999')
  await expect(page.getByText('Doctors with open slots')).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
})

test('the assistant asks follow-ups, suggests doctors and books with a pre-visit summary', async ({
  page,
}, info) => {
  await page.goto('/assistant')
  await page.getByRole('textbox').fill('Burning stomach pain after meals')
  await page.keyboard.press('Enter')

  await expect(page.getByText('How long have you had this problem?')).toBeVisible()
  await page.getByRole('button', { name: 'A few days' }).click()
  await expect(page.getByText('How bad is it: mild, moderate or severe?')).toBeVisible()
  await page.getByRole('button', { name: 'Severe' }).click()

  await expect(page.getByText('Suggested specialty')).toBeVisible()
  await expect(page.getByText('Gastroenterology & Liver', { exact: true })).toBeVisible()
  await expect(page.getByText('Within 48 hours')).toBeVisible()
  await expect(page.getByText(/not a diagnosis/)).toBeVisible()

  const firstSlot = page.getByRole('link', { name: /Serial \d+/ }).first()
  await expect(firstSlot).toBeVisible()
  await firstSlot.click()
  await signInWithPhone(page, info.project.name === 'mobile' ? '01811000012' : '01811000011')
  await expect(page.getByText('The doctor will see a short summary')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm booking' }).click()
  await expect(page.getByRole('heading', { name: 'You’re booked' })).toBeVisible()
})

test('a Bangla problem typed on the home page continues in the assistant', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lumina:lang', 'bn'))
  await page.goto('/')
  await page.getByRole('textbox', { name: 'আপনার সমস্যার কথা লিখুন' }).fill('খাওয়ার পর পেট ব্যথা')
  await page.getByRole('button', { name: 'পাঠান' }).click()
  await expect(page).toHaveURL(/\/assistant$/)
  await expect(page.getByText('খাওয়ার পর পেট ব্যথা')).toBeVisible()
  await expect(page.getByText('কত দিন ধরে এই সমস্যা হচ্ছে?')).toBeVisible()
  await page.getByRole('button', { name: 'কয়েক দিন' }).click()
  await page.getByRole('button', { name: 'হালকা' }).click()
  await expect(page.getByText('পরিপাকতন্ত্র ও লিভার', { exact: true })).toBeVisible()
  await expect(page.getByText(/পরিপাকতন্ত্র ও লিভার বিভাগের ডাক্তাররা দেখেন/)).toBeVisible()
})
