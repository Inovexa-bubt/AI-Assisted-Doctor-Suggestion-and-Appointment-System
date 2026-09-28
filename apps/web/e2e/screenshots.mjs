// Screenshots of any route, e.g. for the design document:
//   npm run dev   (in another terminal)
//   node e2e/screenshots.mjs <outDir> <path> [width=1280] [lang=en]
// Set CHROMIUM_PATH to use an already-installed Chromium instead of Playwright's own.
import { chromium } from '@playwright/test'

const [outDir = '.', path = '/', width = '1280', lang = 'en'] = process.argv.slice(2)
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.addInitScript((l) => localStorage.setItem('lumina:lang', l), lang)
await page.goto(`${process.env.BASE_URL ?? 'http://127.0.0.1:5173'}${path}`, {
  waitUntil: 'networkidle',
})
await page.waitForTimeout(800)
const file = `${outDir}/${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}-${width}-${lang}.png`
await page.screenshot({ path: file, fullPage: true })
console.log(file, errors.length ? `page errors: ${errors.join(' | ')}` : '')
await browser.close()
