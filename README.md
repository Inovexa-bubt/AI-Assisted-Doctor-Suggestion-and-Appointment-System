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

| Path              | What it is                                                                      |
| ----------------- | ------------------------------------------------------------------------------- |
| `apps/web`        | React frontend (Vite, TypeScript, Tailwind CSS, Socket.IO client)               |
| `apps/api`        | Express backend (PostgreSQL 16+ / PGlite, Socket.IO, scheduler, AI/STT/SMS)     |
| `packages/shared` | Types, domain rules, 120-case AI test set, and the sample-data generator        |
| `docs/design`     | System design: architecture, data model, API contract, UML, screens, wireframes |

## Running it

Requires Node.js 22 or later.

### Frontend demo (in-browser mock API)

```bash
npm install
npm run dev          # http://localhost:5173 (uses MSW mock API by default)
```

### Full stack (frontend + real backend API)

```bash
# Terminal 1 — start the API (uses PostgreSQL via DATABASE_URL, or embedded PGlite by default)
cp apps/api/.env.example apps/api/.env
npm run dev:api      # http://localhost:4000

# Terminal 2 — start the frontend pointed at the real API (Vite proxies /api and /socket.io)
VITE_API_MOCK=false npm run dev
```

To import the standalone PostgreSQL 16+ SQL dump into a PostgreSQL database:

```bash
psql -d lumina_hospital -f lumina_hospital_seed.sql
```

Or seed dynamically via Node (uses `@inovexa/shared`'s 3-month sample-data generator):

```bash
npm run db:migrate
npm run db:seed
```

To run the 120-case AI specialty & emergency evaluation benchmark:

```bash
npm run eval:ai
```

### Deploying

- **Docker Compose (PostgreSQL 16 + full stack):**

  ```bash
  docker compose up --build -d
  ```

- **Single-service PaaS (Render / Railway / Fly.io):** build using the root `Dockerfile` (builds `apps/web` with `VITE_API_MOCK=false`, builds `apps/api`, and serves both on `$PORT` with `SERVE_STATIC=true`).
- **Linux VPS with Nginx:** build with `VITE_API_MOCK=false npm run build`, run `node apps/api/dist/server.js` under systemd/PM2, and use [`deploy/nginx.conf`](deploy/nginx.conf).

In frontend-only demo mode (`npm run dev` with `VITE_API_MOCK=true`), the frontend talks to an
in-browser mock API ([Mock Service Worker](https://mswjs.io/)) over sample data generated for today.
With `VITE_API_MOCK=false`, the same screens talk to `apps/api` over `/api/v1` and `/socket.io`.

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
