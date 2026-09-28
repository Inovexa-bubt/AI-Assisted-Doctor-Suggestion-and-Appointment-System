# AI-Assisted Doctor Suggestion and Appointment System

A web app for Lumina Specialized Hospital, built by Inovexa. A visitor types or speaks their health
problem (Bangla or English); an AI assistant suggests the right specialty and doctors with open
slots. Registered patients book, reschedule and cancel online, track their serial live, and get SMS
confirmations and reminders. Staff manage doctors and schedules, run the daily queue, and see
booking analytics.

> The AI assistant only suggests which specialty and doctor to see. It does not diagnose.

## Status

Milestone 1 (week of 24 October 2026): every screen running on sample data, demonstrated to the
client before backend work starts on 1 November.

## Repository layout

| Path              | What it is                                                                    |
| ----------------- | ----------------------------------------------------------------------------- |
| `apps/web`        | React frontend (Vite, TypeScript, Tailwind CSS)                               |
| `packages/shared` | Types, domain rules and the sample-data generator, shared with the future API |
| `docs/design`     | System design: architecture, data model, API contract, UML, screens           |

The backend (`apps/api`, Node.js + Express + PostgreSQL) starts on 1 November 2026.

## Running it

Requires Node.js 22 or later.

```bash
npm install
npm run dev        # frontend on http://localhost:5173 with the mock API
npm test           # unit tests
npm run typecheck
npm run lint
```

Until the backend exists, the frontend talks to a mock API that runs in the browser
([Mock Service Worker](https://mswjs.io/)) over generated sample data. The requests and responses
follow [`docs/design/api.md`](docs/design/api.md), so the same screens work against the real
backend later.
