# Screens

Every screen in the system, by role. The Milestone 1 frontend (`apps/web`) implements all of them on
sample data and serves as the high-fidelity wireframes; screenshots for the Word version of this
document are taken from it.

All screens work in Bangla and English (toggle in the header, remembered per browser) and on phones
from 360 px wide. Patient screens are designed for phones first; staff screens for a desk computer,
but they still work on a tablet.

## Patient site

| #   | Screen             | Route                          | Purpose and contents                                                                                                                                                                             |
| --- | ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | Home               | `/`                            | "Describe your problem" entry to the assistant, doctor search, specialty grid, emergency strip (999), sign-in                                                                                    |
| P2  | AI assistant       | `/assistant`                   | Chat with text and voice input; follow-up questions; emergency notice; result card (specialty, urgency, explanation); suggested doctors with earliest slots; disclaimer and "browse all doctors" |
| P3  | Find a doctor      | `/doctors`                     | Search by name, filter by specialty; cards with fee, chamber days and next open slot                                                                                                             |
| P4  | Doctor profile     | `/doctors/:id`                 | Profile, fee, weekly chambers; 14-day availability with slots; leave days shown as unavailable                                                                                                   |
| P5  | Sign in / register | `/login`                       | Phone number → 6-digit OTP → (new patients) name, age, sex. Returns to where the patient was                                                                                                     |
| P6  | Confirm booking    | `/booking/:appointmentId`      | Slot summary, 5-minute countdown, confirm or change slot. Expired hold sends the patient back to the slots                                                                                       |
| P7  | Booking confirmed  | `/booking/:appointmentId/done` | Serial number, date, time, room; "SMS sent" note; links to live queue and my appointments                                                                                                        |
| P8  | My appointments    | `/appointments`                | Upcoming and past. Upcoming: reschedule, cancel, live queue (on the day). Past: "Book again" with the same doctor                                                                                |
| P9  | Live queue         | `/appointments/:id/queue`      | Your serial, now serving, patients ahead, estimated time; updates live                                                                                                                           |

## Staff portal

| #   | Screen         | Route                      | Roles             | Purpose and contents                                                                                                                                                                                |
| --- | -------------- | -------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Staff sign-in  | `/staff/login`             | all staff         | Username and password                                                                                                                                                                               |
| S2  | Front desk     | `/staff/front-desk`        | front_desk, admin | Doctor and date picker; now-serving panel with "Call next patient"; list by serial with status actions (arrived, seen, no-show) and pre-visit summary; "New booking" for phone and walk-in patients |
| S3  | Doctor view    | `/staff/doctor`            | doctor            | Own list for the day with each patient's pre-visit summary; now serving (read-only)                                                                                                                 |
| S4  | Doctors        | `/staff/admin/doctors`     | admin             | List; add or edit profile, fee, specialty, active flag and weekly chambers (day, times, slot length, patient limit)                                                                                 |
| S5  | Leave days     | `/staff/admin/leave`       | admin             | Add leave day with a preview of how many bookings it cancels; list and remove                                                                                                                       |
| S6  | Specialties    | `/staff/admin/specialties` | admin             | Add, rename (Bangla and English), reorder, deactivate                                                                                                                                               |
| S7  | Settings       | `/staff/admin/settings`    | admin             | Reminder SMS time (days before and time of day); how many days ahead patients can book                                                                                                              |
| S8  | SMS log        | `/staff/admin/sms`         | admin             | Every SMS the system sent or would send, newest first                                                                                                                                               |
| S9  | Staff accounts | `/staff/admin/accounts`    | admin             | Add admin, front-desk and doctor accounts                                                                                                                                                           |
| S10 | Analytics      | `/staff/analytics`         | admin             | Date range; bookings, no-show rate; bookings by specialty; peak hours; bookings per day; most common problems                                                                                       |

## Shared elements

- **Header:** hospital name, language toggle, sign-in state; staff portal adds the role menu.
- **Emergency strip:** on the home page and the assistant: "Chest pain, breathing difficulty or heavy
  bleeding? Go to the emergency department or call 999."
- **Disclaimer:** on every AI result: "This is a suggestion of which doctor to see, not a diagnosis.
  It can be wrong." with a link to browse all doctors.
- **Demo banner (Milestone 1 only):** "Sample data. No SMS is sent." with a reset button.

## Milestone 1 demo script

1. Patient describes "chest pain since morning" → emergency notice, no booking options.
2. Patient describes a stomach problem in Bangla → one or two follow-up questions → Gastroenterology,
   routine, suggested doctors.
3. Picks a slot → signs in with a phone number (demo OTP shown on screen) → 5-minute hold → confirms.
4. Opens the live queue in one tab and the front desk in another; the front desk marks patients
   arrived and calls the next one; the patient's position updates live.
5. Doctor view shows the booked patient's pre-visit summary.
6. Admin adds a leave day for that doctor → preview shows the bookings it cancels → the SMS log
   shows the cancellation messages.
7. Analytics on three months of sample data.
