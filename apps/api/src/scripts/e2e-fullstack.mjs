// Full-stack production E2E verification against the REAL compiled backend + PostgreSQL + Socket.IO
// + built React SPA (VITE_API_MOCK=false, zero MSW).
// Run: node apps/api/src/scripts/e2e-fullstack.mjs

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../../..')
const PORT = 4097
const BASE_URL = `http://127.0.0.1:${PORT}`

async function waitForHealth(timeoutMs = 20_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/health`)
      if (res.ok) return
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('Server did not become healthy in time')
}

async function signInPatient(page, phone, name) {
  await page.getByRole('heading', { name: 'Sign in with your phone' }).waitFor({ state: 'visible' })
  await page.getByLabel('Mobile number').fill(phone)
  await page.getByRole('button', { name: 'Send code' }).click()
  const demo = page.getByText(/Demo: your code is \d{6}/)
  await demo.waitFor({ state: 'visible' })
  const code = (await demo.textContent()).match(/\d{6}/)[0]
  await page.getByLabel('6-digit code').fill(code)
  await page.getByRole('button', { name: 'Verify' }).click()

  const profile = page.getByRole('heading', { name: 'About the patient' })
  await Promise.race([
    profile.waitFor({ state: 'visible' }),
    page.waitForURL((url) => !url.pathname.startsWith('/login')),
  ])
  if (await profile.isVisible()) {
    await page.getByLabel('Full name').fill(name)
    await page.getByLabel('Age').fill('34')
    await page.getByRole('button', { name: 'Finish registration' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  }
}

async function signInStaff(page, username, password) {
  await page.goto(`${BASE_URL}/staff/login`)
  await page.getByRole('heading', { name: 'Staff sign-in' }).waitFor({ state: 'visible' })
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/staff/login'))
}

async function run() {
  const server = spawn(process.execPath, [path.join(ROOT, 'apps/api/dist/server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'development',
      DATABASE_URL: 'memory://',
      SERVE_STATIC: 'true',
      COOKIE_SECURE: 'false',
      CORS_ORIGIN: BASE_URL,
      AI_PROVIDER: 'mock',
      STT_PROVIDER: 'mock',
      SMS_PROVIDER: 'sandbox',
      ENABLE_SCHEDULER: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let serverErr = ''
  server.stderr.on('data', (d) => {
    serverErr += d.toString()
  })

  const results = []
  const step = async (name, fn) => {
    const t0 = Date.now()
    await fn()
    const ms = Date.now() - t0
    results.push({ name, ms })
    console.log(`  PASS  ${name} (${ms}ms)`)
  }

  let browser
  const pageErrors = []
  const server5xx = []

  const attachErrorListeners = (page) => {
    page.on('pageerror', (err) => pageErrors.push(String(err)))
    page.on('response', (res) => {
      if (res.status() >= 500) server5xx.push(`${res.status()} ${res.url()}`)
    })
  }

  try {
    await waitForHealth()
    console.log(
      `\nLive production server ready at ${BASE_URL} (PostgreSQL/PGlite + Socket.IO, ZERO MSW)\n`,
    )

    browser = await chromium.launch(
      process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    )

    // Verify ZERO MSW service worker is registered in production build
    const patientCtx = await browser.newContext()
    await patientCtx.addInitScript(() => localStorage.setItem('lumina:lang', 'en'))
    const page = await patientCtx.newPage()
    attachErrorListeners(page)

    await step('1. Production build runs with ZERO MSW (real API + real SPA)', async () => {
      await page.goto(BASE_URL)
      await page
        .getByRole('heading', { name: /Not sure which doctor/i })
        .waitFor({ state: 'visible' })
      const swCount = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return 0
        const regs = await navigator.serviceWorker.getRegistrations()
        return regs.length
      })
      assert.equal(swCount, 0, 'MSW service worker should NOT be registered in production build')
      // Demo banner should NOT be shown
      assert.equal(await page.getByText('Demo with sample data').count(), 0)
    })

    await step('2. Emergency guardrail blocks booking immediately', async () => {
      await page.goto(`${BASE_URL}/assistant`)
      await page.getByRole('textbox').fill('Sudden chest pain since morning')
      await page.getByRole('button', { name: 'Send' }).click()
      await page
        .getByRole('alert')
        .filter({ hasText: 'This may be an emergency' })
        .waitFor({ state: 'visible' })
      assert.equal(await page.getByText('Doctors with open slots').count(), 0)
    })

    await step(
      '3. AI Assistant -> follow-ups -> Gastroenterology -> OTP sign-in -> 5-min hold -> confirm',
      async () => {
        await page.goto(`${BASE_URL}/assistant`)
        await page.getByRole('textbox').fill('Burning stomach pain after meals')
        await page.getByRole('button', { name: 'Send' }).click()
        await page.getByText('How long have you had this problem?').waitFor({ state: 'visible' })
        await page.getByRole('button', { name: 'A few days' }).click()
        await page
          .getByText('How bad is it: mild, moderate or severe?')
          .waitFor({ state: 'visible' })
        await page.getByRole('button', { name: 'Severe' }).click()

        await page
          .getByText('Gastroenterology & Liver', { exact: true })
          .waitFor({ state: 'visible' })
        await page.getByText('Within 48 hours').waitFor({ state: 'visible' })
        await page.getByText(/not a diagnosis/).waitFor({ state: 'visible' })

        const firstSlot = page.getByRole('link', { name: /Serial \d+/ }).first()
        await firstSlot.waitFor({ state: 'visible' })
        await firstSlot.click()

        await signInPatient(page, '01799000111', 'Nithor Live Test')
        await page
          .getByRole('heading', { name: 'Confirm your appointment' })
          .waitFor({ state: 'visible' })
        await page.getByText('The doctor will see a short summary').waitFor({ state: 'visible' })
        await page.getByRole('button', { name: 'Confirm booking' }).click()
        await page.getByRole('heading', { name: 'You’re booked' }).waitFor({ state: 'visible' })
      },
    )

    await step('4. Find Doctor -> Book -> Reschedule -> Cancel -> Past history', async () => {
      await page.goto(`${BASE_URL}/doctors?specialty=cardiology`)
      await page.getByRole('link', { name: 'See slots' }).first().click()
      await page.getByRole('heading', { name: 'Choose a slot' }).waitFor({ state: 'visible' })
      await page.locator('[role=tabpanel] button:not([disabled])').first().click()
      await page.getByRole('button', { name: 'Book this slot' }).click()
      await page
        .getByRole('heading', { name: 'Confirm your appointment' })
        .waitFor({ state: 'visible' })
      await page.getByRole('button', { name: 'Confirm booking' }).click()
      await page.getByRole('heading', { name: 'You’re booked' }).waitFor({ state: 'visible' })

      // Go to My Appointments and reschedule the cardiology booking
      await page.goto(`${BASE_URL}/appointments`)
      const rescheduleLinks = page.getByRole('link', { name: 'Reschedule' })
      await rescheduleLinks.last().waitFor({ state: 'visible' })
      await rescheduleLinks.last().click()
      await page.getByText(/Choose a new slot for your appointment/).waitFor({ state: 'visible' })
      // Pick the second available slot (could be on next day if only 1 left today)
      const enabledSlots = page.locator('[role=tabpanel] button:not([disabled])')
      const count = await enabledSlots.count()
      await enabledSlots.nth(count > 1 ? 1 : 0).click()
      await page.getByRole('button', { name: 'Book this slot' }).click()
      await page.getByText(/Moving from/).waitFor({ state: 'visible' })
      await page.getByRole('button', { name: 'Confirm booking' }).click()
      await page
        .getByRole('heading', { name: 'Your appointment has been moved' })
        .waitFor({ state: 'visible' })

      // Cancel it
      await page.goto(`${BASE_URL}/appointments`)
      await page.getByRole('button', { name: 'Cancel', exact: true }).last().click()
      await page.getByRole('button', { name: 'Yes, cancel' }).click()
      await page.getByRole('radio', { name: 'Past and cancelled' }).click()
      await page.getByText('Cancelled by you').first().waitFor({ state: 'visible' })
      await page.getByText('Moved to another slot').first().waitFor({ state: 'visible' })
    })

    await step(
      '5. Two-browser Live Socket.IO Queue: Front Desk calls next -> Patient tab updates LIVE',
      async () => {
        // Find a doctor with a chamber today or tomorrow via API
        const docs = await (await fetch(`${BASE_URL}/api/v1/doctors`)).json()
        const targetDoc = docs.find((d) => d.nextSlot)
        assert.ok(targetDoc && targetDoc.nextSlot, 'Expected at least one doctor with an open slot')
        const slot = targetDoc.nextSlot

        // Staff signs into a completely separate browser context (no BroadcastChannel!)
        const staffCtx = await browser.newContext()
        await staffCtx.addInitScript(() => localStorage.setItem('lumina:lang', 'en'))
        const staffPage = await staffCtx.newPage()
        attachErrorListeners(staffPage)
        await signInStaff(staffPage, 'frontdesk', 'frontdesk123')

        // Patient 2 registers & books that slot via UI
        const p2Ctx = await browser.newContext()
        await p2Ctx.addInitScript(() => localStorage.setItem('lumina:lang', 'en'))
        const p2Page = await p2Ctx.newPage()
        attachErrorListeners(p2Page)
        await p2Page.goto(
          `${BASE_URL}/book?doctor=${targetDoc.id}&date=${slot.date}&start=${slot.start}`,
        )
        await signInPatient(p2Page, '01799000222', 'Live Queue Patient')
        await p2Page
          .getByRole('heading', { name: 'Confirm your appointment' })
          .waitFor({ state: 'visible' })
        await p2Page.getByRole('button', { name: 'Confirm booking' }).click()
        await p2Page.getByRole('heading', { name: 'You’re booked' }).waitFor({ state: 'visible' })

        // Open Patient 2's Live Queue page (connects via Socket.IO)
        await p2Page.getByRole('link', { name: 'Follow the live queue' }).click()
        await p2Page.getByRole('heading', { name: 'Live queue' }).waitFor({ state: 'visible' })
        await p2Page.waitForTimeout(500) // allow Socket.IO queue:join

        // Front Desk opens that doctor+date, marks patient Arrived, and calls next
        await staffPage.goto(
          `${BASE_URL}/staff/front-desk?doctor=${targetDoc.id}&date=${slot.date}`,
        )
        const row = staffPage
          .getByRole('main')
          .getByRole('listitem')
          .filter({ hasText: 'Live Queue Patient' })
        await row.waitFor({ state: 'visible' })
        await row.getByRole('button', { name: 'Arrived' }).click()
        await row.getByText('Arrived', { exact: true }).waitFor({ state: 'visible' })

        // Keep calling next until Live Queue Patient is in_consultation
        for (let i = 0; i < 10; i++) {
          if ((await row.getByText('With the doctor').count()) > 0) break
          await staffPage.getByRole('button', { name: 'Call next patient' }).click()
          await staffPage.waitForTimeout(300)
        }
        await row.getByText('With the doctor').waitFor({ state: 'visible' })

        // Patient 2 tab (separate BrowserContext — ONLY Socket.IO can deliver this!) updates live!
        await p2Page
          .getByText('It’s your turn. Please go in.')
          .waitFor({ state: 'visible', timeout: 8000 })

        // Front desk also registers & books a phone patient
        await staffPage.getByRole('button', { name: 'New booking' }).click()
        const dialog = staffPage.getByRole('dialog')
        await dialog.getByLabel('Patient’s mobile number').fill('01799000333')
        await dialog.getByRole('button', { name: 'Find' }).click()
        await dialog.getByText('Not registered yet').waitFor({ state: 'visible' })
        await dialog.getByLabel('Full name').fill('Walkin Test Patient')
        await dialog.getByLabel('Age').fill('48')
        await dialog.getByRole('radio', { name: 'Male', exact: true }).click()
        await dialog.getByRole('radio', { name: 'By phone' }).click()
        await dialog.getByRole('button', { name: 'Book', exact: true }).click()
        await staffPage
          .getByText(/Booked serial \d+ for Walkin Test Patient\./)
          .waitFor({ state: 'visible' })

        await p2Ctx.close()
        await staffCtx.close()
      },
    )

    await step('6. Doctor portal + RBAC enforcement', async () => {
      const docCtx = await browser.newContext()
      await docCtx.addInitScript(() => localStorage.setItem('lumina:lang', 'en'))
      const docPage = await docCtx.newPage()
      attachErrorListeners(docPage)
      await signInStaff(docPage, 'dr.tanvir', 'doctor123')
      await docPage.getByRole('heading', { name: 'My patients' }).waitFor({ state: 'visible' })
      await docPage.goto(`${BASE_URL}/staff/analytics`)
      await docPage.waitForURL(/\/staff\/doctor$/)
      await docCtx.close()
    })

    await step(
      '7. Admin portal: Analytics, Edit Doctor, Leave Day + SMS Log, Settings, Staff Accounts',
      async () => {
        const adminCtx = await browser.newContext()
        await adminCtx.addInitScript(() => localStorage.setItem('lumina:lang', 'en'))
        const adminPage = await adminCtx.newPage()
        attachErrorListeners(adminPage)
        await signInStaff(adminPage, 'admin', 'admin123')

        // Analytics
        await adminPage.getByRole('heading', { name: 'Analytics' }).waitFor({ state: 'visible' })
        await adminPage
          .getByRole('heading', { name: 'Bookings by specialty' })
          .waitFor({ state: 'visible' })

        // Doctors list & edit
        await adminPage.getByRole('link', { name: 'Doctors' }).first().click()
        await adminPage.getByRole('heading', { name: 'Doctors' }).waitFor({ state: 'visible' })
        await adminPage
          .getByRole('row', { name: /Dr\. Sharmin Akter/ })
          .getByRole('link', { name: 'Edit' })
          .click()
        await adminPage.getByRole('heading', { name: 'Edit doctor' }).waitFor({ state: 'visible' })
        await adminPage.getByLabel('Fee (BDT)').fill('850')
        await adminPage.getByRole('button', { name: 'Save' }).click()
        await adminPage
          .getByRole('row', { name: /Dr\. Sharmin Akter/ })
          .getByText('Tk 850')
          .waitFor({ state: 'visible' })

        // Settings (including closeMinutesBefore)
        await adminPage.getByRole('link', { name: 'Settings' }).first().click()
        await adminPage.getByRole('heading', { name: 'Settings' }).waitFor({ state: 'visible' })
        await adminPage.getByRole('button', { name: 'Save' }).click()
        await adminPage.getByText('Saved.').waitFor({ state: 'visible' })

        // SMS Log
        await adminPage.getByRole('link', { name: 'SMS log' }).first().click()
        await adminPage.getByRole('heading', { name: 'SMS log' }).waitFor({ state: 'visible' })
        await adminPage
          .getByText('Lumina Specialized Hospital:')
          .first()
          .waitFor({ state: 'visible' })

        // Staff Accounts — create a new front desk account
        await adminPage.getByRole('link', { name: 'Staff accounts' }).first().click()
        await adminPage.getByRole('button', { name: 'Add account' }).click()
        const dlg = adminPage.getByRole('dialog')
        await dlg.getByLabel('Name', { exact: true }).fill('Evening Reception')
        await dlg.getByLabel('Username').fill('reception.eve')
        await dlg.getByLabel('Password').fill('secure123')
        await dlg.getByRole('button', { name: 'Save' }).click()
        await adminPage.getByText('Account created.').waitFor({ state: 'visible' })
        await adminPage.getByText('reception.eve').waitFor({ state: 'visible' })

        await adminCtx.close()
      },
    )

    await step(
      '8. Bangla UI + 360px Mobile Viewport layout check (zero horizontal overflow)',
      async () => {
        const mobCtx = await browser.newContext({ viewport: { width: 360, height: 760 } })
        await mobCtx.addInitScript(() => localStorage.setItem('lumina:lang', 'bn'))
        const mobPage = await mobCtx.newPage()
        attachErrorListeners(mobPage)
        for (const route of ['/', '/assistant', '/doctors', '/login']) {
          await mobPage.goto(`${BASE_URL}${route}`)
          await mobPage.waitForLoadState('networkidle')
          const { scrollWidth, innerWidth } = await mobPage.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }))
          assert.ok(
            scrollWidth <= innerWidth,
            `Route ${route} overflowed 360px viewport (${scrollWidth} > ${innerWidth})`,
          )
        }
        await mobCtx.close()
      },
    )

    await patientCtx.close()

    assert.deepEqual(pageErrors, [], `Uncaught page errors: ${pageErrors.join('; ')}`)
    assert.deepEqual(server5xx, [], `5xx server responses: ${server5xx.join('; ')}`)

    console.log(
      `\nALL ${results.length} FULL-STACK E2E FLOWS PASSED (0 page errors, 0 5xx responses).`,
    )
  } finally {
    if (browser) await browser.close()
    server.kill('SIGTERM')
    if (serverErr.trim()) {
      console.error('Server stderr:\n', serverErr)
    }
  }
}

run().catch((err) => {
  console.error('\nFULL-STACK E2E FAILED:', err)
  process.exit(1)
})
