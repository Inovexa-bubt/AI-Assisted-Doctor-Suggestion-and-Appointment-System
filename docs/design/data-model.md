# Data model

PostgreSQL 16. All times are Asia/Dhaka (UTC+6, no daylight saving). Appointment dates are stored as
`date` and chamber times as `time`, both in Dhaka local time; audit timestamps are `timestamptz`.
The TypeScript shapes the API returns are in [`packages/shared/src/types.ts`](../../packages/shared/src/types.ts).

## ER diagram

```mermaid
erDiagram
  SPECIALTY ||--o{ DOCTOR : "has"
  DOCTOR ||--o{ SCHEDULE_RULE : "chambers on"
  DOCTOR ||--o{ LEAVE_DAY : "takes"
  DOCTOR ||--o{ APPOINTMENT : "sees"
  DOCTOR ||--o| STAFF_USER : "signs in as"
  DOCTOR ||--o{ QUEUE_STATE : "runs"
  PATIENT ||--o{ APPOINTMENT : "books"
  PATIENT |o--o{ TRIAGE_SESSION : "describes"
  TRIAGE_SESSION |o--o{ APPOINTMENT : "leads to"
  SPECIALTY |o--o{ TRIAGE_SESSION : "suggested in"
  APPOINTMENT |o--o| APPOINTMENT : "rescheduled from"
  APPOINTMENT |o--o{ SMS_MESSAGE : "notifies"
  QUEUE_STATE |o--o| APPOINTMENT : "now serving"

  SPECIALTY {
    text id PK "slug, e.g. cardiology"
    text name_en
    text name_bn
    text description_en
    text description_bn
    smallint sort_order
    boolean active
  }
  DOCTOR {
    uuid id PK
    text name_en
    text name_bn
    text specialty_id FK
    text designation_en
    text designation_bn
    text qualifications
    smallint experience_years
    integer fee "BDT"
    text gender
    boolean active
  }
  SCHEDULE_RULE {
    uuid id PK
    uuid doctor_id FK
    smallint weekday "0 = Sunday"
    time start_time
    time end_time
    smallint slot_minutes
    smallint max_patients
    text room
  }
  LEAVE_DAY {
    uuid id PK
    uuid doctor_id FK
    date date "unique with doctor_id"
    text reason
  }
  PATIENT {
    uuid id PK
    text name
    text phone UK "01XXXXXXXXX"
    smallint age
    text sex
    text registered_by "self | front_desk"
    timestamptz phone_verified_at
  }
  APPOINTMENT {
    uuid id PK
    uuid patient_id FK
    uuid doctor_id FK
    date date
    time start_time
    time end_time
    smallint serial
    text status
    text source "online | phone | walk_in"
    timestamptz hold_expires_at
    uuid triage_id FK
    uuid rescheduled_from_id FK
    text cancel_reason
    timestamptz called_at
  }
  TRIAGE_SESSION {
    uuid id PK
    uuid patient_id FK "null until booking"
    text lang "bn | en"
    text problem
    jsonb answers "follow-up Q and A"
    text status
    text specialty_id FK
    text urgency
    text explanation
    text[] tags
    jsonb summary "pre-visit summary"
  }
  QUEUE_STATE {
    uuid doctor_id PK
    date date PK
    uuid now_serving_id FK
    timestamptz updated_at
  }
  STAFF_USER {
    uuid id PK
    text name
    text username UK
    text password_hash
    text role "admin | front_desk | doctor"
    uuid doctor_id FK
    boolean active
  }
  SMS_MESSAGE {
    uuid id PK
    text phone
    text kind
    text body
    uuid appointment_id FK
    text status "queued | sent | failed"
    timestamptz sent_at
  }
```

Two supporting tables are left out of the diagram: `otp_code` (phone, code hash, expiry, attempts)
and `setting` (key, JSON value).

## Tables

| Table            | Notes                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `specialty`      | The client's specialty list. The AI may only suggest one of these.                            |
| `doctor`         | Profile shown to patients. Deactivating hides the doctor without losing history.              |
| `schedule_rule`  | One row per weekly chamber session. A doctor can have several per day (morning and evening).  |
| `leave_day`      | Inserting one cancels that day's active appointments and queues SMS (one transaction).        |
| `patient`        | Only what booking needs: name, phone, age, sex.                                               |
| `appointment`    | The booking and its live status. `serial` is the position in the session.                     |
| `triage_session` | The AI conversation. No name or phone. Linked to the patient only when they book.             |
| `queue_state`    | Which appointment each doctor is seeing now, per date.                                        |
| `staff_user`     | Admin, front-desk and doctor accounts. A doctor account links to one `doctor` row.            |
| `sms_message`    | Every SMS the system sends, for audit and retry. OTP bodies are stored with the code masked.  |
| `otp_code`       | Hashed one-time codes; 5-minute expiry, 5 attempts.                                           |
| `setting`        | `reminder` (`daysBefore`, `time`, default 1 day before at 19:00); `booking` (`openDays`, 14). |

## Appointment status

```mermaid
stateDiagram-v2
  [*] --> held: patient picks a slot
  held --> booked: patient confirms within 5 min
  held --> [*]: hold expires (row deleted)
  [*] --> booked: front desk books (phone or walk-in)
  booked --> arrived: front desk marks arrived
  booked --> cancelled: patient, staff, leave day or reschedule
  booked --> no_show: front desk marks no-show
  arrived --> in_consultation: front desk calls the patient
  arrived --> no_show: left before being called
  in_consultation --> seen: next patient called, or marked seen
  arrived --> seen: marked seen directly
  seen --> [*]
  no_show --> [*]
  cancelled --> [*]
```

`cancel_reason` is one of `patient`, `staff`, `leave_day` or `rescheduled`.

## Slot locking

"Two patients can never book the same slot" is enforced by the database, not only by the API:

```sql
CREATE UNIQUE INDEX appointment_one_per_slot
  ON appointment (doctor_id, date, start_time)
  WHERE status <> 'cancelled';
```

Booking a slot runs in one transaction:

1. Delete any expired hold on that slot:
   `DELETE FROM appointment WHERE doctor_id = $1 AND date = $2 AND start_time = $3 AND status = 'held' AND hold_expires_at < now();`
2. Insert the new appointment with `status = 'held'` and `hold_expires_at = now() + interval '5 minutes'`.
3. A unique-index violation means someone else holds or booked the slot: return `409 SLOT_TAKEN`.

Confirming updates the row to `booked` only if the hold is still valid
(`WHERE id = $1 AND status = 'held' AND hold_expires_at > now()`); otherwise it returns
`410 HOLD_EXPIRED`. The scheduler also deletes expired holds every minute so they stop showing as
taken.

Front-desk bookings skip the hold and insert `booked` directly; the same index protects them.

## Indexes

| Index                                   | Used by                            |
| --------------------------------------- | ---------------------------------- |
| `appointment (doctor_id, date, serial)` | Queue, front-desk and doctor lists |
| `appointment (patient_id, date)`        | My appointments                    |
| `appointment (date, status)`            | Reminders, analytics               |
| `patient (phone)` unique                | Login, front-desk search           |
| `leave_day (doctor_id, date)` unique    | Availability                       |
| `triage_session (created_at)`           | Analytics, retention clean-up      |

## Retention

- Triage sessions that never lead to a booking hold no identity. _To confirm:_ delete them after 90
  days.
- `otp_code` rows are deleted after 24 hours.
