# API contract

REST over HTTPS, JSON bodies, base path `/api/v1`. The request and response types are defined once in
[`packages/shared/src/types.ts`](../../packages/shared/src/types.ts) and used by both the frontend
and the backend. In Milestone 1 the mock API in `apps/web/src/mocks` implements this contract.

## Conventions

- **Dates** are `YYYY-MM-DD` and **times** `HH:mm`, both in Asia/Dhaka time. Timestamps are ISO 8601.
- **Money** is whole Bangladeshi taka (BDT).
- **Phone numbers** are 11-digit Bangladeshi mobiles (`01[3-9]XXXXXXXX`). The API also accepts
  `+880` and `880` prefixes and normalises them.
- **Auth** uses HTTP-only session cookies: `sid` for patients, `staff_sid` for staff. The frontend
  never handles tokens.
- **Errors** return a non-2xx status and this body:

```json
{ "error": { "code": "SLOT_TAKEN", "message": "Someone else just took this slot." } }
```

| Status | `code`                                                                              | When                                    |
| ------ | ----------------------------------------------------------------------------------- | --------------------------------------- |
| 400    | `VALIDATION`                                                                        | Body or query fails validation          |
| 401    | `UNAUTHENTICATED`                                                                   | No valid session                        |
| 403    | `FORBIDDEN`                                                                         | Signed in, but the role may not do this |
| 404    | `NOT_FOUND`                                                                         | Unknown ID                              |
| 409    | `SLOT_TAKEN`, `DOCTOR_ON_LEAVE`, `SLOT_IN_PAST`, `BOOKING_CLOSED`, `ALREADY_BOOKED` | The slot cannot be held or booked       |
| 410    | `HOLD_EXPIRED`                                                                      | Confirming after the 5-minute hold      |
| 422    | `OTP_INVALID`, `OTP_EXPIRED`                                                        | Wrong or old code                       |
| 429    | `TOO_MANY_ATTEMPTS`                                                                 | OTP or login rate limit                 |

## Public (no sign-in)

| Method | Path                                                | Response            | Notes                                                                                                      |
| ------ | --------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| GET    | `/specialties`                                      | `Specialty[]`       | Active specialties, in display order                                                                       |
| GET    | `/doctors?specialtyId=&q=`                          | `DoctorListItem[]`  | `q` matches Bangla or English name; includes `nextSlot`                                                    |
| GET    | `/doctors/:id`                                      | `Doctor`            |                                                                                                            |
| GET    | `/doctors/:id/availability?from=YYYY-MM-DD&days=14` | `AvailabilityDay[]` | Sessions and slots per day; `onLeave` days have no sessions; `closed` sessions are past the online cut-off |
| POST   | `/triage`                                           | `TriageResult`      | Body `{ problem, lang }`. Starts an AI conversation                                                        |
| POST   | `/triage/:id/answers`                               | `TriageResult`      | Body `{ answer }`. Answers the pending follow-up question                                                  |
| POST   | `/speech/transcribe`                                | `{ text }`          | `multipart/form-data`: `audio`, `lang`. Audio is not stored                                                |

### Triage result

`session.status` says what the screen shows next:

| `status`       | Screen shows                                                                     |
| -------------- | -------------------------------------------------------------------------------- |
| `emergency`    | Emergency notice only. `session.emergencyMatches` lists the phrases that matched |
| `needs_answer` | `session.question` (at most 3 per conversation) and `session.quickReplies`       |
| `complete`     | `specialtyId`, `urgency`, `explanation` and `suggestions`                        |

`suggestions` lists doctors in the suggested specialty with their earliest open slots. For
`within_48h` urgency they are sorted by earliest slot.

```json
{
  "session": {
    "id": "t_8f2c",
    "lang": "en",
    "problem": "Burning pain in my stomach after eating for two weeks",
    "answers": [{ "question": "How bad is it?", "answer": "Moderate" }],
    "status": "complete",
    "specialtyId": "gastroenterology",
    "urgency": "routine",
    "explanation": "Burning stomach pain after meals is usually seen by a gastroenterologist.",
    "tags": ["stomach_pain"]
  },
  "suggestions": [
    {
      "doctor": { "id": "d_07", "name": { "en": "Dr. Tanvir Hasan", "bn": "ডা. তানভীর হাসান" } },
      "slots": [
        { "date": "2026-10-04", "start": "17:30", "end": "17:45", "serial": 3, "available": true }
      ]
    }
  ]
}
```

## Patient sign-in

| Method | Path            | Body                 | Response                                      |
| ------ | --------------- | -------------------- | --------------------------------------------- |
| POST   | `/auth/otp`     | `{ phone }`          | `{ expiresInSeconds }`; sends the code by SMS |
| POST   | `/auth/verify`  | `{ phone, code }`    | `{ patient, needsProfile }`; sets `sid`       |
| POST   | `/auth/profile` | `{ name, age, sex }` | `Patient`; completes a new registration       |
| GET    | `/auth/me`      |                      | `Patient` or 401                              |
| POST   | `/auth/logout`  |                      | 204                                           |

A new phone number gets `needsProfile: true` and a session that can only call `/auth/profile`.

## Appointments (patient)

| Method | Path                           | Body / query                                          | Response             |
| ------ | ------------------------------ | ----------------------------------------------------- | -------------------- |
| POST   | `/appointments/holds`          | `{ doctorId, date, start, triageId?, rescheduleOf? }` | `Appointment` (held) |
| GET    | `/appointments/:id`            |                                                       | `AppointmentView`    |
| POST   | `/appointments/:id/confirm`    |                                                       | `AppointmentView`    |
| DELETE | `/appointments/:id/hold`       |                                                       | 204                  |
| GET    | `/appointments?scope=upcoming` | `scope` is `upcoming` or `past`                       | `AppointmentView[]`  |
| POST   | `/appointments/:id/cancel`     |                                                       | `AppointmentView`    |
| GET    | `/appointments/:id/queue`      |                                                       | `QueueStatus`        |

- **Reschedule** is a hold with `rescheduleOf` set, then a confirm. Confirming cancels the old
  appointment (`cancel_reason = rescheduled`) in the same transaction and sends a reschedule SMS.
- `GET /appointments/:id` returns a held appointment for the confirm screen (410 once the hold
  expires); for a reschedule it includes `rescheduledFrom`.
- **Rebook** needs no endpoint: "Book again" opens the doctor's availability.
- **One upcoming booking per doctor.** A hold without `rescheduleOf` fails with `ALREADY_BOOKED`
  when the patient already has a booked, arrived or in-consultation appointment with that doctor
  today or later. The patient reschedules it instead. Front-desk bookings are not limited.
- **Online cut-off.** Online booking for a session closes `Settings.booking.closeMinutesBefore`
  minutes (default 60) before the session starts: availability marks the session `closed` and a
  hold fails with `BOOKING_CLOSED`. The front desk can still book its free slots.
- Confirming links the triage session (if any) and generates the pre-visit summary.

## Staff sign-in

| Method | Path            | Body                     | Response    |
| ------ | --------------- | ------------------------ | ----------- |
| POST   | `/staff/login`  | `{ username, password }` | `StaffUser` |
| GET    | `/staff/me`     |                          | `StaffUser` |
| POST   | `/staff/logout` |                          | 204         |

## Admin (`admin`)

| Method | Path                                       | Body / response                                                   |
| ------ | ------------------------------------------ | ----------------------------------------------------------------- |
| GET    | `/admin/specialties`                       | `Specialty[]`, including inactive                                 |
| POST   | `/admin/specialties`                       | `SpecialtyInput` → `Specialty`                                    |
| PUT    | `/admin/specialties/:id`                   | `SpecialtyInput` → `Specialty`                                    |
| GET    | `/admin/doctors`                           | `Doctor[]`, including inactive                                    |
| POST   | `/admin/doctors`                           | `DoctorInput` (profile and schedule rules) → `Doctor`             |
| PUT    | `/admin/doctors/:id`                       | `DoctorInput` → `Doctor`                                          |
| GET    | `/admin/leave-days?doctorId=`              | `LeaveDay[]`, upcoming first                                      |
| GET    | `/admin/leave-days/impact?doctorId=&date=` | `{ appointments }`: how many bookings adding it would cancel      |
| POST   | `/admin/leave-days`                        | `{ doctorId, date, reason }` → `{ leaveDay, cancelled, smsSent }` |
| DELETE | `/admin/leave-days/:id`                    | 204. Cancelled bookings stay cancelled                            |
| GET    | `/admin/settings`                          | `Settings`                                                        |
| PUT    | `/admin/settings`                          | `Settings` → `Settings`                                           |
| GET    | `/admin/sms?limit=100`                     | `SmsMessage[]`, newest first                                      |
| GET    | `/admin/staff`                             | `StaffUser[]`                                                     |
| POST   | `/admin/staff`                             | `{ name, username, password, role, doctorId? }` → `StaffUser`     |

Editing a schedule rule does not move existing bookings. _To confirm:_ what should happen to
bookings outside the new hours.

## Front desk (`front_desk`, `admin`)

| Method | Path                                 | Body / response                                                                                                                                                                    |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/frontdesk/day?doctorId=&date=`     | `DaySheet`: sessions (no online cut-off), `onLeave`, appointments with patient, summary and `previousVisits` (`{ count, last }`: earlier seen visits to this doctor), `nowServing` |
| POST   | `/frontdesk/appointments/:id/status` | `{ status: "arrived" \| "seen" \| "no_show" }` → `AppointmentView`. A no-show can be marked arrived again (late arrival)                                                           |
| POST   | `/frontdesk/queue/next`              | `{ doctorId, date }` → `DaySheet`                                                                                                                                                  |
| GET    | `/frontdesk/patients?phone=`         | `Patient` or 404                                                                                                                                                                   |
| POST   | `/frontdesk/patients`                | `{ name, phone, age, sex }` → `Patient` (no OTP)                                                                                                                                   |
| POST   | `/frontdesk/appointments`            | `{ patientId, doctorId, date, start, source: "phone" \| "walk_in" }` → `AppointmentView`                                                                                           |

## Doctor (`doctor`)

| Method | Path                | Response                                 |
| ------ | ------------------- | ---------------------------------------- |
| GET    | `/doctor/day?date=` | `DaySheet` for the signed-in doctor only |

## Analytics (`admin`)

| Method | Path                   | Response                                                                                          |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------- |
| GET    | `/analytics?from=&to=` | `AnalyticsSummary`: totals, no-show rate, bookings by specialty, by hour, by day, common problems |

## Realtime

Socket.IO at `/socket.io`. A client joins the room for one doctor's session:

```ts
socket.emit('queue:join', { doctorId, date })
socket.on('queue:changed', ({ doctorId, date, nowServing }) => refetchQueueStatus())
```

The server emits `queue:changed` after "call next", a status change, a new booking or a
cancellation for that doctor and date. Events carry no patient data; clients refetch over REST, which
checks permissions. In Milestone 1 the mock sends the same event between browser tabs with a
`BroadcastChannel`.
