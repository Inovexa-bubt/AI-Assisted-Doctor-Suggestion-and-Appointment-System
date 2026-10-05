# UI wireframes

Low-fidelity wireframes of every screen, version 0.1 (5 October 2026). They show what is on each
screen and how it behaves, not the final look: grey boxes, real labels, and numbered notes that are
explained in the Notes column of each board. The running frontend (`npm run dev`) shows the same
screens with real styling.

Patient screens are drawn at phone size (390 px), staff screens at desktop size (1440 px).

| File                                                   | Board                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [`00-cover.svg`](00-cover.svg)                         | How to read the boards, and the list of screens                     |
| [`01-flows.svg`](01-flows.svg)                         | How the screens connect, for patients, front desk, doctor and admin |
| [`P1-home.svg`](P1-home.svg)                           | Home                                                                |
| [`P2-ai-assistant.svg`](P2-ai-assistant.svg)           | AI assistant: start, follow-up, suggestion, emergency               |
| [`P3-find-a-doctor.svg`](P3-find-a-doctor.svg)         | Find a doctor                                                       |
| [`P4-doctor-profile.svg`](P4-doctor-profile.svg)       | Doctor profile and slots                                            |
| [`P5-sign-in.svg`](P5-sign-in.svg)                     | Sign in and register                                                |
| [`P6-confirm-booking.svg`](P6-confirm-booking.svg)     | Confirm booking (5-minute hold)                                     |
| [`P7-booking-confirmed.svg`](P7-booking-confirmed.svg) | Booking confirmed                                                   |
| [`P8-my-appointments.svg`](P8-my-appointments.svg)     | My appointments: upcoming, cancel, past                             |
| [`P9-live-queue.svg`](P9-live-queue.svg)               | Live queue                                                          |
| [`S01-staff-sign-in.svg`](S01-staff-sign-in.svg)       | Staff sign-in                                                       |
| [`S02-front-desk.svg`](S02-front-desk.svg)             | Front desk, and booking for phone and walk-in patients              |
| [`S03-doctor-view.svg`](S03-doctor-view.svg)           | Doctor view with pre-visit summaries                                |
| [`S04-doctors.svg`](S04-doctors.svg)                   | Doctors: list and edit, with weekly chambers                        |
| [`S05-leave-days.svg`](S05-leave-days.svg)             | Leave days                                                          |
| [`S06-specialties.svg`](S06-specialties.svg)           | Specialties: list and edit                                          |
| [`S07-settings.svg`](S07-settings.svg)                 | Settings                                                            |
| [`S08-sms-log.svg`](S08-sms-log.svg)                   | SMS log                                                             |
| [`S09-staff-accounts.svg`](S09-staff-accounts.svg)     | Staff accounts: list and add                                        |
| [`S10-analytics.svg`](S10-analytics.svg)               | Analytics                                                           |

## Opening them in Figma

1. Download this folder (or the whole repository).
2. Open the Figma design file and drag all the `.svg` files onto the canvas at once.
3. Each file becomes one frame. Text, boxes and icons stay editable; layers are named after what
   they are (header, button, note markers and so on).

The text uses Inter and, for Bangla, Hind Siliguri. Both are Google fonts that Figma has built in.
