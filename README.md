# AI-Assisted Doctor Suggestion and Appointment System

A web app for Lumina Specialized Hospital, built by Inovexa. A visitor types or speaks their health
problem (Bangla or English); an AI assistant suggests the right specialty and doctors with open
slots. Registered patients book, reschedule and cancel online, track their serial live, and get SMS
confirmations and reminders. Staff manage doctors and schedules, run the daily queue, and see
booking analytics.

> The AI assistant only suggests which specialty and doctor to see. It does not diagnose.

## Status

**Milestone 1 (week of 24 October 2026): every screen runs on sample data.** Backend work starts on
1 November 2026.

| Area         | Screens                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Patient site | Home, AI assistant, find a doctor, doctor profile and slots, phone sign-in, booking, my appointments, live queue |
| Staff portal | Front desk, doctor view, analytics, doctors, leave days, specialties, settings, SMS log, staff accounts          |

## Repository layout

| Path              | What it is                                                                    |
| ----------------- | ----------------------------------------------------------------------------- |
| `apps/web`        | React frontend (Vite, TypeScript, Tailwind CSS)                               |
| `packages/shared` | Types, domain rules and the sample-data generator, shared with the future API |
| `docs/design`     | System design: architecture, data model, API contract, UML, screens           |

## Running it

Requires Node.js 22 or later.

```bash
npm install
npm run dev          # http://localhost:5173
```

Until the backend exists, the frontend talks to a mock API that runs in the browser
([Mock Service Worker](https://mswjs.io/)) over sample data generated for today. The requests and
responses follow [`docs/design/api.md`](docs/design/api.md), so the same screens will work against
the real backend.

### Using the demo

- **Patients:** sign in with any valid Bangladeshi mobile number (like `01712345678`). No SMS is
  sent; the one-time code is shown on screen.
- **Staff:** open `/staff`. The sign-in page lists the demo accounts:

  | Role       | Username    | Password       |
  | ---------- | ----------- | -------------- |
  | Admin      | `admin`     | `admin123`     |
  | Front desk | `frontdesk` | `frontdesk123` |
  | Doctor     | `dr.tanvir` | `doctor123`    |

- **Two tabs, one hospital:** changes are shared between tabs of the same browser, so a patient's
  live queue moves when the front desk calls the next patient in another tab.
- **Reset:** "Reset demo data" in the top bar throws away every change. Data also starts fresh
  each day.

The demo script for the client is in [`docs/design/screens.md`](docs/design/screens.md#milestone-1-demo-script).

## Checks

```bash
npm test             # unit tests (shared rules and the mock API)
npm run typecheck
npm run lint
npm run format:check
npm run e2e -w @inovexa/web   # Playwright end-to-end tests (starts the dev server)
```

For end-to-end tests, run `npx playwright install chromium` once, or set `CHROMIUM_PATH` to an
installed Chromium.
