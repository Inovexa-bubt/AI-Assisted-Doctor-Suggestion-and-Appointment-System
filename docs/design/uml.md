# UML diagrams

All diagrams are Mermaid, so they render on GitHub and can be exported for the Word version of the
design document. The appointment state diagram is in [Data model](data-model.md#appointment-status).

## Use case diagram

Mermaid has no use case diagram type, so actors are drawn as rounded nodes and use cases as stadium
shapes inside the system boundary.

```mermaid
flowchart LR
  V(["Visitor"])
  P(["Registered patient"])
  F(["Front-desk staff"])
  D(["Doctor"])
  A(["Admin"])
  AI(["AI service"])
  SMS(["SMS gateway"])

  subgraph System["AI-Assisted Doctor Suggestion and Appointment System"]
    UC1(["Describe problem by text or voice"])
    UC2(["Get specialty and doctor suggestions"])
    UC3(["See emergency notice"])
    UC4(["Search and browse doctors"])
    UC5(["Register / sign in with phone OTP"])
    UC6(["Book a slot (5-minute hold)"])
    UC7(["Reschedule, cancel or rebook"])
    UC8(["Track live serial"])
    UC9(["Manage daily list: arrived, seen, no-show"])
    UC10(["Call next patient"])
    UC11(["Register and book phone or walk-in patients"])
    UC12(["View daily list with pre-visit summaries"])
    UC13(["Manage doctors, specialties, chambers, slots, limits"])
    UC14(["Add leave day (cancels bookings, sends SMS)"])
    UC15(["Set reminder time"])
    UC16(["View analytics"])
    UC17(["Send confirmations, reminders, cancellations"])
  end

  V --- UC1
  V --- UC4
  V --- UC5
  UC1 -. include .-> UC2
  UC1 -. extend .-> UC3
  P --- UC1
  P --- UC4
  P --- UC6
  P --- UC7
  P --- UC8
  F --- UC9
  F --- UC10
  F --- UC11
  D --- UC12
  A --- UC13
  A --- UC14
  A --- UC15
  A --- UC16
  UC2 --- AI
  UC6 -. include .-> UC17
  UC7 -. include .-> UC17
  UC14 -. include .-> UC17
  UC17 --- SMS
```

## Class diagram

Domain classes and the backend services that act on them. Services map to modules in `apps/api`.

```mermaid
classDiagram
  direction LR
  class Specialty {
    +id: string
    +name: Localized
    +description: Localized
    +active: boolean
  }
  class Doctor {
    +id: string
    +name: Localized
    +specialtyId: string
    +fee: number
    +schedule: ScheduleRule[]
    +active: boolean
  }
  class ScheduleRule {
    +weekday: 0..6
    +start: HH:mm
    +end: HH:mm
    +slotMinutes: number
    +maxPatients: number
    +slotsFor(date) Slot[]
  }
  class LeaveDay {
    +doctorId: string
    +date: string
    +reason: string
  }
  class Patient {
    +id: string
    +name: string
    +phone: string
    +age: number
    +sex: Sex
  }
  class Appointment {
    +id: string
    +date: string
    +start: HH:mm
    +serial: number
    +status: AppointmentStatus
    +source: AppointmentSource
    +holdExpiresAt: Date
  }
  class TriageSession {
    +id: string
    +lang: bn|en
    +problem: string
    +answers: TriageAnswer[]
    +specialtyId: string
    +urgency: Urgency
    +summary: PreVisitSummary
  }
  class StaffUser {
    +username: string
    +role: admin|front_desk|doctor
    +doctorId: string
  }
  class QueueState {
    +doctorId: string
    +date: string
    +nowServingId: string
  }

  class AvailabilityService {
    +daysFor(doctor, from, days) AvailabilityDay[]
  }
  class BookingService {
    +hold(patient, doctorId, date, start) Appointment
    +confirm(appointmentId) Appointment
    +cancel(appointmentId, reason) Appointment
    +bookForPatient(staff, patientId, slot, source) Appointment
  }
  class QueueService {
    +callNext(doctorId, date) QueueState
    +statusFor(appointmentId) QueueStatus
  }
  class TriageService {
    +start(problem, lang) TriageResult
    +answer(sessionId, answer) TriageResult
    +summarize(sessionId) PreVisitSummary
  }
  class EmergencyCheck {
    +check(text) string[]
  }
  class NotificationService {
    +send(kind, appointment)
    +sendDueReminders(now)
  }
  class LeaveService {
    +addLeaveDay(doctorId, date, reason) LeaveResult
  }

  Specialty "1" --> "*" Doctor
  Doctor "1" *-- "*" ScheduleRule
  Doctor "1" --> "*" LeaveDay
  Doctor "1" --> "*" Appointment
  Patient "1" --> "*" Appointment
  TriageSession "0..1" --> "*" Appointment
  StaffUser "0..1" --> "1" Doctor
  QueueState --> Appointment : nowServing

  AvailabilityService ..> ScheduleRule
  AvailabilityService ..> LeaveDay
  BookingService ..> AvailabilityService
  BookingService ..> NotificationService
  TriageService ..> EmergencyCheck
  TriageService ..> AvailabilityService
  LeaveService ..> BookingService
  QueueService ..> Appointment
```

## Sequence: AI assistant to suggestion

```mermaid
sequenceDiagram
  actor V as Visitor
  participant W as Web app
  participant API as API
  participant K as Emergency check
  participant L as LLM service
  participant DB as Database

  V->>W: Types (or speaks) the problem
  W->>K: check(text) (instant, in the browser)
  alt keyword matched
    W-->>V: Emergency notice, no booking options
  else no match
    W->>API: POST /triage { problem, lang }
    API->>K: check(text) (enforced again on the server)
    API->>L: problem + specialty guide (no name or phone)
    L-->>API: { needsMoreInfo, question } or { specialtyId, urgency, explanation }
    alt needs more detail (max 3 questions)
      API-->>W: status needs_answer, question
      W-->>V: Follow-up question
      V->>W: Answer
      W->>API: POST /triage/:id/answers
      Note over API,L: Same checks and LLM call, with the answers
    end
    API->>DB: Doctors in specialty + open slots
    API-->>W: status complete, suggestions
    W-->>V: Specialty, urgency, explanation, doctors, disclaimer
  end
```

## Sequence: booking with a 5-minute hold

```mermaid
sequenceDiagram
  actor P as Patient
  participant W as Web app
  participant API as API
  participant DB as Database
  participant S as SMS gateway

  P->>W: Picks a slot
  alt not signed in
    W-->>P: Phone number, then OTP code
    P->>W: Code
    W->>API: POST /auth/verify
  end
  W->>API: POST /appointments/holds
  API->>DB: delete expired hold on slot, insert status held (expires in 5 min)
  alt unique index violation
    API-->>W: 409 SLOT_TAKEN
    W-->>P: Slot just taken, choose another
  else held
    API-->>W: Appointment (held, holdExpiresAt)
    W-->>P: Confirm screen with countdown
    P->>W: Confirm
    W->>API: POST /appointments/:id/confirm
    API->>DB: update to booked if hold still valid
    alt hold expired
      API-->>W: 410 HOLD_EXPIRED
    else booked
      API->>DB: link triage session, save pre-visit summary
      API->>S: Confirmation SMS
      API-->>W: AppointmentView
      W-->>P: Booked, serial number and time
    end
  end
```

## Sequence: front desk calls the next patient

```mermaid
sequenceDiagram
  actor F as Front desk
  participant W as Front-desk screen
  participant API as API
  participant DB as Database
  participant IO as Socket.IO
  participant PW as Patient's phone

  PW->>IO: queue:join { doctorId, date }
  F->>W: Call next patient
  W->>API: POST /frontdesk/queue/next
  API->>DB: current in_consultation → seen
  API->>DB: lowest-serial arrived → in_consultation, update queue_state
  API->>IO: emit queue:changed { doctorId, date, nowServing }
  API-->>W: DaySheet
  IO-->>PW: queue:changed
  PW->>API: GET /appointments/:id/queue
  API-->>PW: nowServing, ahead, estimated time
```

## Sequence: admin adds a leave day

```mermaid
sequenceDiagram
  actor A as Admin
  participant W as Admin panel
  participant API as API
  participant DB as Database
  participant S as SMS gateway

  A->>W: Picks doctor and date
  W->>API: GET /admin/leave-days/impact
  API-->>W: { appointments: 7 }
  W-->>A: "7 bookings will be cancelled and patients notified"
  A->>W: Confirm
  W->>API: POST /admin/leave-days
  API->>DB: insert leave_day, cancel active appointments (leave_day), queue SMS (one transaction)
  API->>S: Cancellation SMS to each patient
  API-->>W: { leaveDay, cancelled: 7, smsSent: 7 }
```

## Activity: patient books an appointment

```mermaid
flowchart TD
  S([Start]) --> H{"Knows which doctor?"}
  H -- no --> AI["Use the AI assistant"] --> E{"Emergency?"}
  E -- yes --> N["Go to emergency / call 999"] --> X([End])
  E -- no --> SG["Pick a suggested doctor"]
  H -- yes --> SR["Search by name or specialty"] --> DP["Doctor profile"]
  SG --> DP
  DP --> SL["Pick a date and slot"]
  SL --> LI{"Signed in?"}
  LI -- no --> OTP["Phone number → OTP → name, age, sex"] --> HD
  LI -- yes --> HD["Slot held for 5 minutes"]
  HD --> T{"Slot still free?"}
  T -- no --> SL
  T -- yes --> C{"Confirms within 5 minutes?"}
  C -- no --> REL["Hold released"] --> SL
  C -- yes --> B["Booked: SMS confirmation"]
  B --> R["Reminder SMS at the admin-set time"]
  R --> Q["On the day: track live serial"]
  Q --> X
```

## Activity: front desk runs a session

```mermaid
flowchart TD
  S([Session starts]) --> L["Open today's list for the doctor"]
  L --> A{"Patient at the desk?"}
  A -- "has a booking" --> MA["Mark arrived"]
  A -- "no booking" --> WI["Find or register by phone → book walk-in slot"] --> MA
  MA --> CN["Call next patient"]
  CN --> Q{"Anyone else arrived?"}
  Q -- yes --> CN
  Q -- no --> M{"Booked patients still missing?"}
  M -- "they may still come" --> A
  M -- "session over" --> NS["Mark remaining as no-show"] --> E([Session ends])
```
