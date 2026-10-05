import { type Locator, type Page, expect, test } from '@playwright/test'
import { freshStart } from './helpers.ts'

test.beforeEach(async ({ page }) => freshStart(page))

/** Each page with something that only appears once its data has loaded. */
const PAGES: [string, (page: Page) => Locator][] = [
  ['/', (p) => p.getByRole('link', { name: /Gastroenterology|পরিপাকতন্ত্র/ })],
  ['/assistant', (p) => p.getByRole('textbox')],
  ['/doctors', (p) => p.getByRole('link', { name: /See slots|সময় দেখুন/ }).first()],
  ['/doctors/d04', (p) => p.locator('[role=tabpanel] button').first()],
  ['/login', (p) => p.getByRole('textbox').first()],
]

for (const lang of ['en', 'bn']) {
  test(`patient pages fit a 360 px phone (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 })
    await page.goto('/')
    await page.evaluate((l) => localStorage.setItem('lumina:lang', l), lang)
    for (const [path, ready] of PAGES) {
      await page.goto(path)
      await expect(ready(page)).toBeVisible()
      // A page wider than the screen makes the phone scroll sideways.
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(scrollWidth, `${path} is wider than the screen`).toBeLessThanOrEqual(innerWidth)
    }
  })
}
