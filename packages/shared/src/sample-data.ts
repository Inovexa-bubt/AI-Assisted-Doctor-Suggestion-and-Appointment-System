// Sample-data generator: realistic doctors, patients and three months of appointments, relative
// to "today", for the Milestone 1 demo and for testing. Every name is invented. The same seed and
// date always produce the same data.

import { DEFAULT_OPEN_DAYS } from './constants.ts'
import { Rng, hashSeed } from './random.ts'
import { daySlots } from './slots.ts'
import { smsBody } from './sms.ts'
import { SPECIALTIES } from './specialty-guide.ts'
import { addDays, dhakaInstant, dhakaMinutes, dhakaDate, toMinutes, weekdayOf } from './time.ts'
import { type MockAnswer, followUpQuestion, runMockTriage } from './triage-mock.ts'
import type {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
  Doctor,
  Lang,
  LeaveDay,
  Patient,
  PreVisitSummary,
  Settings,
  SmsMessage,
  Specialty,
  StaffUser,
  TriageSession,
  Weekday,
} from './types.ts'

/** A stored AI conversation, with the fields the API does not return. */
export interface TriageRecord extends TriageSession {
  /** Answers with the kind of question they answer; the API returns only question and answer. */
  answers: MockAnswer[]
  patientId?: string
  summary?: PreVisitSummary
  createdAt: string
}

export interface StaffAccount extends StaffUser {
  /** Mock only. The real backend stores a bcrypt hash. */
  password: string
}

export interface QueueRecord {
  doctorId: string
  date: string
  nowServingId: string | null
}

export interface SampleData {
  /** The Dhaka date the data was generated for. */
  generatedFor: string
  specialties: Specialty[]
  doctors: Doctor[]
  leaveDays: LeaveDay[]
  patients: Patient[]
  appointments: Appointment[]
  triage: TriageRecord[]
  staff: StaffAccount[]
  queue: QueueRecord[]
  sms: SmsMessage[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  reminder: { daysBefore: 1, time: '19:00' },
  booking: { openDays: DEFAULT_OPEN_DAYS },
}

const DAY: Record<string, Weekday> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

type SessionDef = [
  days: string,
  start: string,
  end: string,
  slotMinutes: number,
  maxPatients: number,
]

interface DoctorDef {
  en: string
  bn: string
  gender: 'female' | 'male'
  specialtyId: string
  designation: 'Senior Consultant' | 'Consultant' | 'Associate Consultant'
  qualifications: string
  years: number
  fee: number
  room: string
  sessions: SessionDef[]
}

const DESIGNATION_BN = {
  'Senior Consultant': 'সিনিয়র কনসালট্যান্ট',
  Consultant: 'কনসালট্যান্ট',
  'Associate Consultant': 'অ্যাসোসিয়েট কনসালট্যান্ট',
} as const

// Invented doctors. Fridays are the weekly holiday.
// prettier-ignore
const DOCTORS: DoctorDef[] = [
  { en: 'Dr. Mahmudul Hasan', bn: 'ডা. মাহমুদুল হাসান', gender: 'male', specialtyId: 'medicine', designation: 'Senior Consultant', qualifications: 'MBBS, FCPS (Medicine)', years: 18, fee: 1000, room: 'Room 101', sessions: [['Sun,Tue,Thu', '17:00', '21:00', 12, 20]] },
  { en: 'Dr. Sharmin Akter', bn: 'ডা. শারমিন আক্তার', gender: 'female', specialtyId: 'medicine', designation: 'Consultant', qualifications: 'MBBS, FCPS (Medicine)', years: 9, fee: 800, room: 'Room 102', sessions: [['Sat,Mon,Wed', '10:00', '13:00', 10, 18]] },
  { en: 'Dr. Arifur Rahman', bn: 'ডা. আরিফুর রহমান', gender: 'male', specialtyId: 'medicine', designation: 'Consultant', qualifications: 'MBBS, MD (Internal Medicine)', years: 10, fee: 900, room: 'Room 103', sessions: [['Sat,Mon,Wed', '17:00', '21:00', 12, 20]] },
  { en: 'Dr. Rezaul Karim', bn: 'ডা. রেজাউল করিম', gender: 'male', specialtyId: 'cardiology', designation: 'Senior Consultant', qualifications: 'MBBS, MD (Cardiology)', years: 22, fee: 1500, room: 'Room 201', sessions: [['Sat,Mon,Wed', '18:00', '21:00', 15, 12]] },
  { en: 'Dr. Nadia Islam', bn: 'ডা. নাদিয়া ইসলাম', gender: 'female', specialtyId: 'cardiology', designation: 'Consultant', qualifications: 'MBBS, MD (Cardiology)', years: 11, fee: 1200, room: 'Room 202', sessions: [['Sun,Tue', '10:00', '13:00', 15, 12]] },
  { en: 'Dr. Anisur Rahman', bn: 'ডা. আনিসুর রহমান', gender: 'male', specialtyId: 'neurology', designation: 'Consultant', qualifications: 'MBBS, MD (Neurology)', years: 14, fee: 1200, room: 'Room 203', sessions: [['Sun,Wed', '17:00', '20:00', 15, 12]] },
  { en: 'Dr. Lubna Yasmin', bn: 'ডা. লুবনা ইয়াসমিন', gender: 'female', specialtyId: 'neurology', designation: 'Associate Consultant', qualifications: 'MBBS, MD (Neurology)', years: 7, fee: 1000, room: 'Room 204', sessions: [['Sat,Mon', '10:00', '13:00', 15, 12]] },
  { en: 'Dr. Tanvir Hasan', bn: 'ডা. তানভীর হাসান', gender: 'male', specialtyId: 'gastroenterology', designation: 'Consultant', qualifications: 'MBBS, MD (Gastroenterology)', years: 12, fee: 1000, room: 'Room 301', sessions: [['Sat,Mon,Thu', '17:30', '20:30', 12, 15], ['Thu', '10:00', '12:00', 12, 10]] },
  { en: 'Dr. Farzana Chowdhury', bn: 'ডা. ফারজানা চৌধুরী', gender: 'female', specialtyId: 'gastroenterology', designation: 'Associate Consultant', qualifications: 'MBBS, FCPS (Medicine), MD (Gastroenterology)', years: 8, fee: 900, room: 'Room 302', sessions: [['Sun,Tue', '10:00', '12:30', 10, 15]] },
  { en: 'Dr. Kamrul Islam', bn: 'ডা. কামরুল ইসলাম', gender: 'male', specialtyId: 'orthopedics', designation: 'Senior Consultant', qualifications: 'MBBS, MS (Orthopaedics)', years: 20, fee: 1200, room: 'Room 303', sessions: [['Sat,Tue,Thu', '16:00', '20:00', 15, 16]] },
  { en: 'Dr. Sabrina Haque', bn: 'ডা. সাবরিনা হক', gender: 'female', specialtyId: 'orthopedics', designation: 'Consultant', qualifications: 'MBBS, MS (Orthopaedics)', years: 7, fee: 1000, room: 'Room 304', sessions: [['Mon,Wed', '10:30', '13:00', 15, 10]] },
  { en: 'Dr. Rokeya Begum', bn: 'ডা. রোকেয়া বেগম', gender: 'female', specialtyId: 'gynecology', designation: 'Senior Consultant', qualifications: 'MBBS, FCPS (Gynae & Obs)', years: 21, fee: 1200, room: 'Room 401', sessions: [['Sat,Mon,Wed', '16:00', '20:00', 12, 20]] },
  { en: 'Dr. Tahmina Ahmed', bn: 'ডা. তাহমিনা আহমেদ', gender: 'female', specialtyId: 'gynecology', designation: 'Consultant', qualifications: 'MBBS, FCPS (Gynae & Obs)', years: 10, fee: 1000, room: 'Room 402', sessions: [['Sun,Tue,Thu', '10:00', '13:00', 12, 15]] },
  { en: 'Dr. Shafiqul Alam', bn: 'ডা. শফিকুল আলম', gender: 'male', specialtyId: 'pediatrics', designation: 'Senior Consultant', qualifications: 'MBBS, FCPS (Paediatrics)', years: 16, fee: 1000, room: 'Room 403', sessions: [['Sat,Sun,Tue,Thu', '17:00', '20:00', 10, 18]] },
  { en: 'Dr. Ishrat Jahan', bn: 'ডা. ইশরাত জাহান', gender: 'female', specialtyId: 'pediatrics', designation: 'Consultant', qualifications: 'MBBS, DCH, FCPS (Paediatrics)', years: 9, fee: 900, room: 'Room 404', sessions: [['Mon,Wed', '10:00', '13:00', 10, 18]] },
  { en: 'Dr. Abdul Mannan', bn: 'ডা. আবদুল মান্নান', gender: 'male', specialtyId: 'ent', designation: 'Consultant', qualifications: 'MBBS, DLO, FCPS (ENT)', years: 15, fee: 1000, room: 'Room 501', sessions: [['Sun,Tue,Thu', '17:00', '20:00', 12, 15]] },
  { en: 'Dr. Sumaiya Rahman', bn: 'ডা. সুমাইয়া রহমান', gender: 'female', specialtyId: 'dermatology', designation: 'Consultant', qualifications: 'MBBS, DDV, FCPS (Dermatology)', years: 8, fee: 1000, room: 'Room 502', sessions: [['Sat,Mon,Wed', '17:00', '20:00', 10, 18]] },
  { en: 'Dr. Mizanur Rahman', bn: 'ডা. মিজানুর রহমান', gender: 'male', specialtyId: 'respiratory', designation: 'Senior Consultant', qualifications: 'MBBS, FCPS (Medicine), MD (Chest)', years: 19, fee: 1200, room: 'Room 503', sessions: [['Sun,Wed', '17:00', '20:00', 15, 12]] },
  { en: 'Dr. Shahana Parvin', bn: 'ডা. শাহানা পারভীন', gender: 'female', specialtyId: 'endocrinology', designation: 'Consultant', qualifications: 'MBBS, MD (Endocrinology)', years: 13, fee: 1200, room: 'Room 504', sessions: [['Sat,Tue,Thu', '10:00', '13:00', 15, 12]] },
  { en: 'Dr. Jahangir Alam', bn: 'ডা. জাহাঙ্গীর আলম', gender: 'male', specialtyId: 'ophthalmology', designation: 'Consultant', qualifications: 'MBBS, FCPS (Ophthalmology)', years: 17, fee: 900, room: 'Room 601', sessions: [['Sat,Mon,Wed', '16:00', '19:00', 10, 18]] },
  { en: 'Dr. Rafiqul Islam', bn: 'ডা. রফিকুল ইসলাম', gender: 'male', specialtyId: 'psychiatry', designation: 'Consultant', qualifications: 'MBBS, FCPS (Psychiatry)', years: 12, fee: 1200, room: 'Room 602', sessions: [['Tue,Thu', '17:00', '20:00', 20, 9]] },
  { en: 'Dr. Moinul Hossain', bn: 'ডা. মঈনুল হোসেন', gender: 'male', specialtyId: 'urology', designation: 'Consultant', qualifications: 'MBBS, MS (Urology)', years: 14, fee: 1200, room: 'Room 603', sessions: [['Sun,Wed', '18:00', '21:00', 15, 12]] },
]

function buildDoctors(): Doctor[] {
  return DOCTORS.map((d, i) => {
    const id = `d${String(i + 1).padStart(2, '0')}`
    const specialty = SPECIALTIES.find((s) => s.id === d.specialtyId)!
    let n = 0
    return {
      id,
      name: { en: d.en, bn: d.bn },
      specialtyId: d.specialtyId,
      designation: {
        en: `${d.designation}, ${specialty.name.en}`,
        bn: `${DESIGNATION_BN[d.designation]}, ${specialty.name.bn}`,
      },
      qualifications: d.qualifications,
      experienceYears: d.years,
      fee: d.fee,
      gender: d.gender,
      active: true,
      schedule: d.sessions.flatMap(([days, start, end, slotMinutes, maxPatients]) =>
        days.split(',').map((day) => ({
          id: `${id}-r${++n}`,
          weekday: DAY[day]!,
          start,
          end,
          slotMinutes,
          maxPatients,
          room: d.room,
        })),
      ),
    }
  })
}

// prettier-ignore
const FIRST_MALE = ['Rahim', 'Karim', 'Hasan', 'Tariq', 'Arif', 'Sakib', 'Rafiq', 'Jamal', 'Kamal', 'Nayeem', 'Imran', 'Shafiq', 'Mahmud', 'Rashed', 'Sohel', 'Fahim', 'Masud', 'Habib', 'Rakib', 'Zahid', 'Faisal', 'Mizan', 'Anwar', 'Babul']
// prettier-ignore
const FIRST_FEMALE = ['Fatema', 'Ayesha', 'Nasima', 'Sumi', 'Sumaiya', 'Shirin', 'Rumana', 'Nasrin', 'Sadia', 'Jannat', 'Mim', 'Tania', 'Rokeya', 'Salma', 'Parvin', 'Lima', 'Rina', 'Moushumi', 'Afroza', 'Dilruba', 'Kulsum', 'Shapla']
// prettier-ignore
const LAST = ['Ahmed', 'Hossain', 'Rahman', 'Islam', 'Khan', 'Chowdhury', 'Uddin', 'Miah', 'Sarker', 'Das', 'Roy', 'Biswas', 'Talukder', 'Siddiqui', 'Mondal', 'Sheikh']
const LAST_FEMALE_ONLY = ['Akter', 'Begum', 'Khatun']
const BN_NAMES_MALE = ['রহিম উদ্দিন', 'আবুল কালাম', 'জসিম মিয়া', 'মোস্তফা কামাল']
const BN_NAMES_FEMALE = ['ফাতেমা বেগম', 'নাসিমা আক্তার', 'শাহানা খাতুন', 'রাবেয়া খাতুন']

function buildPatients(rng: Rng, count: number): Patient[] {
  const phones = new Set<string>()
  const patients: Patient[] = []
  for (let i = 0; i < count; i++) {
    const sex = rng.chance(0.52) ? 'female' : 'male'
    const name = rng.chance(0.08)
      ? rng.pick(sex === 'female' ? BN_NAMES_FEMALE : BN_NAMES_MALE)
      : sex === 'female'
        ? `${rng.pick(FIRST_FEMALE)} ${rng.pick([...LAST, ...LAST_FEMALE_ONLY])}`
        : `${rng.pick(FIRST_MALE)} ${rng.pick(LAST)}`
    let phone: string
    do {
      phone = `01${rng.pick(['3', '4', '5', '6', '7', '8', '9'])}${String(rng.int(0, 99_999_999)).padStart(8, '0')}`
    } while (phones.has(phone))
    phones.add(phone)
    const age = rng.chance(0.18) ? rng.int(1, 14) : rng.int(18, 78)
    patients.push({
      id: `p${String(i + 1).padStart(4, '0')}`,
      name,
      phone,
      age,
      sex,
      registeredBy: rng.chance(0.8) ? 'self' : 'front_desk',
    })
  }
  return patients
}

/** Sample problem descriptions per specialty, as patients might type them. */
// prettier-ignore
export const SAMPLE_PROBLEMS: Record<string, Array<[Lang, string]>> = {
  medicine: [['en', 'Fever and body ache for three days'], ['bn', 'তিন দিন ধরে জ্বর আর শরীর ব্যথা'], ['en', 'Feeling weak and tired all the time'], ['bn', 'খুব দুর্বল লাগে, সবসময় ক্লান্ত']],
  cardiology: [['en', 'My blood pressure is high and I get palpitations'], ['bn', 'প্রেশার বেড়েছে, মাঝে মাঝে বুক ধড়ফড় করে'], ['en', 'Heart beating fast when I climb stairs']],
  neurology: [['en', 'Headache every day and dizziness'], ['bn', 'প্রতিদিন মাথাব্যথা আর মাথা ঘোরা'], ['en', 'Numbness and tingling in my hands']],
  gastroenterology: [['en', 'Stomach pain and acidity after meals'], ['bn', 'খাওয়ার পর পেট ব্যথা আর গ্যাস্ট্রিক'], ['en', 'Loose motion and vomiting since yesterday'], ['bn', 'জন্ডিস হয়েছে, খাবারে অরুচি']],
  orthopedics: [['en', 'Lower back pain for weeks'], ['bn', 'অনেক দিন ধরে কোমর ব্যথা'], ['en', 'Knee pain when climbing stairs'], ['bn', 'হাঁটুতে ব্যথা, হাঁটতে কষ্ট হয়']],
  gynecology: [['en', 'Irregular periods for a few months'], ['bn', 'কয়েক মাস ধরে মাসিক অনিয়মিত'], ['en', 'I am pregnant and need a check-up']],
  pediatrics: [['en', 'My child has fever and cough'], ['bn', 'বাচ্চার দুই দিন ধরে জ্বর আর কাশি'], ['en', 'My baby is not feeding well and has loose motion']],
  ent: [['en', 'Ear pain and blocked nose'], ['bn', 'কানে ব্যথা আর কম শুনি'], ['en', 'Sore throat and tonsil pain']],
  dermatology: [['en', 'Itchy skin rash on my arms'], ['bn', 'চামড়ায় চুলকানি আর ফুসকুড়ি'], ['bn', 'চুল পড়ে যাচ্ছে, খুশকি']],
  respiratory: [['en', 'Cough for a month and wheezing at night'], ['bn', 'অনেক দিনের কাশি আর হাঁপানি']],
  endocrinology: [['en', 'My blood sugar is not under control'], ['bn', 'ডায়াবেটিস নিয়ন্ত্রণে নেই'], ['en', 'Thyroid problem and weight gain']],
  ophthalmology: [['en', 'Blurry vision and eye pain'], ['bn', 'চোখে ঝাপসা দেখি, চোখ লাল']],
  psychiatry: [['en', "Anxiety and I can't sleep at night"], ['bn', 'দুশ্চিন্তা আর রাতে ঘুম হয় না']],
  urology: [['en', 'Burning when passing urine'], ['bn', 'প্রস্রাবে জ্বালাপোড়া আর কোমরের পাশে ব্যথা'], ['en', 'Kidney stone pain on the right side']],
}

/** Problems that trigger the emergency notice, for realistic analytics. */
const SAMPLE_EMERGENCIES: Array<[Lang, string]> = [
  ['en', 'Sudden chest pain and sweating'],
  ['bn', 'হঠাৎ বুকে ব্যথা'],
  ['bn', 'শ্বাস নিতে কষ্ট হচ্ছে'],
]

/** Plays a conversation to the end, answering follow-ups with the first or a random quick reply. */
function simulateTriage(rng: Rng, problem: string, lang: Lang) {
  const answers: MockAnswer[] = []
  for (;;) {
    const outcome = runMockTriage({ problem, lang, answers })
    if (outcome.status !== 'needs_answer') return { outcome, answers }
    const { question, quickReplies } = followUpQuestion(outcome.kind, lang)
    const answer = quickReplies.length
      ? rng.pick(quickReplies)
      : lang === 'bn'
        ? 'আর কোনো সমস্যা নেই'
        : 'Nothing else'
    answers.push({ kind: outcome.kind, question, answer })
  }
}

function makeTriage(
  rng: Rng,
  id: string,
  problem: string,
  lang: Lang,
  createdAt: string,
  patientId?: string,
): TriageRecord {
  const { outcome, answers } = simulateTriage(rng, problem, lang)
  const base = {
    id,
    lang,
    problem,
    answers,
    tags: outcome.tags,
    createdAt,
    ...(patientId ? { patientId } : {}),
  }
  if (outcome.status === 'emergency') {
    return { ...base, status: 'emergency', emergencyMatches: outcome.emergencyMatches }
  }
  if (outcome.status !== 'complete') throw new Error('triage did not finish')
  return {
    ...base,
    status: 'complete',
    specialtyId: outcome.specialtyId,
    urgency: outcome.urgency,
    explanation: outcome.explanation,
    summary: outcome.summary,
  }
}

function pastStatus(rng: Rng): AppointmentStatus {
  const r = rng.next()
  return r < 0.8 ? 'seen' : r < 0.92 ? 'no_show' : 'cancelled'
}

/**
 * Generates the full sample data set for `now` (default: the current time).
 * History covers the 90 days before today; bookings run to the end of the booking window.
 */
export function generateSampleData(options: { now?: Date; seed?: number } = {}): SampleData {
  const now = options.now ?? new Date()
  const today = dhakaDate(now)
  const nowMin = dhakaMinutes(now)
  const rng = new Rng(options.seed ?? hashSeed(today))

  const specialties = SPECIALTIES.map((s) => ({ ...s }))
  const doctors = buildDoctors()
  const patients = buildPatients(rng, 500)

  // Leave days: two past, two upcoming (on a chamber day inside the booking window).
  const leaveDays: LeaveDay[] = []
  const addLeave = (doctor: Doctor, fromOffset: number, reason: string) => {
    for (let i = fromOffset; i < fromOffset + 7; i++) {
      const date = addDays(today, i)
      if (doctor.schedule.some((r) => r.weekday === weekdayOf(date))) {
        leaveDays.push({ id: `l${leaveDays.length + 1}`, doctorId: doctor.id, date, reason })
        return
      }
    }
  }
  addLeave(doctors[3]!, -40, 'Conference')
  addLeave(doctors[9]!, -20, 'Personal')
  addLeave(doctors[5]!, 5, 'Conference abroad')
  addLeave(doctors[16]!, 9, 'Personal')
  const leaveSet = new Set(leaveDays.map((l) => `${l.doctorId} ${l.date}`))

  const appointments: Appointment[] = []
  const triage: TriageRecord[] = []
  const queue: QueueRecord[] = []
  const popularity = new Map(doctors.map((d) => [d.id, 0.45 + rng.next() * 0.35]))
  const openDays = DEFAULT_SETTINGS.booking.openDays

  for (let offset = -90; offset < openDays; offset++) {
    const date = addDays(today, offset)
    for (const doctor of doctors) {
      if (leaveSet.has(`${doctor.id} ${date}`)) continue
      const slots = daySlots(doctor, date)
      if (slots.length === 0) continue
      const fill =
        offset < 0
          ? popularity.get(doctor.id)!
          : offset === 0
            ? 0.75
            : offset <= 2
              ? 0.6
              : offset <= 6
                ? 0.4
                : 0.18
      const dayAppointments: Appointment[] = []
      for (const slot of slots) {
        if (!rng.chance(fill)) continue
        const patient = rng.pick(patients)
        const sessionStarted = offset === 0 && toMinutes(slot.rule.start) <= nowMin
        const source: AppointmentSource =
          offset > 0 || (offset === 0 && !sessionStarted)
            ? rng.chance(0.75)
              ? 'online'
              : 'phone'
            : rng.chance(0.65)
              ? 'online'
              : rng.chance(0.7)
                ? 'phone'
                : 'walk_in'
        const bookedDaysBefore = source === 'walk_in' ? 0 : rng.int(0, Math.min(6, offset + 90))
        const createdDate = addDays(
          date,
          -Math.max(0, Math.min(bookedDaysBefore, offset < 0 ? 90 : offset)),
        )
        let created = dhakaInstant(
          createdDate,
          `${String(rng.int(8, 21)).padStart(2, '0')}:${String(rng.int(0, 59)).padStart(2, '0')}`,
        )
        if (created > now) created = new Date(now.getTime() - rng.int(5, 600) * 60_000)

        let status: AppointmentStatus
        if (offset < 0) status = pastStatus(rng)
        else if (offset > 0) status = rng.chance(0.07) ? 'cancelled' : 'booked'
        else if (toMinutes(slot.rule.end) <= nowMin) status = pastStatus(rng)
        else if (toMinutes(slot.start) + slot.rule.slotMinutes <= nowMin)
          status = rng.chance(0.88) ? 'seen' : 'no_show'
        else status = rng.chance(0.05) ? 'cancelled' : 'booked'

        const appointment: Appointment = {
          id: `a${String(appointments.length + 1).padStart(5, '0')}`,
          patientId: patient.id,
          doctorId: doctor.id,
          date,
          start: slot.start,
          end: slot.end,
          serial: slot.serial,
          status,
          source,
          createdAt: created.toISOString(),
          ...(status === 'cancelled'
            ? { cancelReason: rng.chance(0.85) ? ('patient' as const) : ('staff' as const) }
            : {}),
          ...(status === 'seen' ? { calledAt: dhakaInstant(date, slot.start).toISOString() } : {}),
        }
        if (source === 'online' && rng.chance(0.45)) {
          const [lang, problem] = rng.pick(SAMPLE_PROBLEMS[doctor.specialtyId]!)
          const t = makeTriage(
            rng,
            `t${String(triage.length + 1).padStart(5, '0')}`,
            problem,
            lang,
            new Date(created.getTime() - 4 * 60_000).toISOString(),
            patient.id,
          )
          triage.push(t)
          appointment.triageId = t.id
        }
        appointments.push(appointment)
        dayAppointments.push(appointment)
      }

      // Today: sessions in progress have one patient in consultation and a few who have arrived.
      if (offset === 0) {
        const inProgress = dayAppointments.filter((a) => {
          const rule = slots.find((s) => s.start === a.start)!.rule
          return (
            toMinutes(rule.start) <= nowMin && nowMin < toMinutes(rule.end) && a.status === 'booked'
          )
        })
        const current = inProgress[0]
        if (current) {
          current.status = 'in_consultation'
          current.calledAt = new Date(now.getTime() - rng.int(1, 8) * 60_000).toISOString()
          for (const a of inProgress.slice(1, 1 + rng.int(1, 3))) a.status = 'arrived'
        }
        if (slots.some((s) => toMinutes(s.rule.start) <= nowMin)) {
          queue.push({ doctorId: doctor.id, date, nowServingId: current?.id ?? null })
        }
      }
    }
  }

  // AI conversations that did not lead to a booking, for "most common problems".
  const allProblems = Object.values(SAMPLE_PROBLEMS).flat()
  for (let i = 0; i < 260; i++) {
    const [lang, problem] = rng.chance(0.04) ? rng.pick(SAMPLE_EMERGENCIES) : rng.pick(allProblems)
    const date = addDays(today, -rng.int(0, 89))
    let created = dhakaInstant(
      date,
      `${String(rng.int(7, 23)).padStart(2, '0')}:${String(rng.int(0, 59)).padStart(2, '0')}`,
    )
    if (created > now) created = new Date(now.getTime() - rng.int(10, 300) * 60_000)
    triage.push(
      makeTriage(
        rng,
        `t${String(triage.length + 1).padStart(5, '0')}`,
        problem,
        lang,
        created.toISOString(),
      ),
    )
  }

  // Recent SMS: confirmations for bookings made in the last day.
  const doctorById = new Map(doctors.map((d) => [d.id, d]))
  const patientById = new Map(patients.map((p) => [p.id, p]))
  const sms: SmsMessage[] = appointments
    .filter((a) => a.status !== 'cancelled' && now.getTime() - Date.parse(a.createdAt) < 86_400_000)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((a, i) => {
      const doctor = doctorById.get(a.doctorId)!
      return {
        id: `s${String(i + 1).padStart(4, '0')}`,
        phone: patientById.get(a.patientId)!.phone,
        kind: 'confirmation' as const,
        body: smsBody('confirmation', {
          doctorName: doctor.name.en,
          date: a.date,
          start: a.start,
          serial: a.serial,
          room: doctor.schedule[0]?.room,
        }),
        appointmentId: a.id,
        status: 'sent' as const,
        createdAt: a.createdAt,
      }
    })
    .reverse()
    .slice(0, 40)

  const staff: StaffAccount[] = [
    {
      id: 'u1',
      name: 'Hospital Admin',
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      active: true,
    },
    {
      id: 'u2',
      name: 'Front Desk',
      username: 'frontdesk',
      password: 'frontdesk123',
      role: 'front_desk',
      active: true,
    },
    ...doctors.map((d, i) => ({
      id: `u${i + 3}`,
      name: d.name.en,
      username: `dr.${d.name.en.split(' ')[1]!.toLowerCase()}`,
      password: 'doctor123',
      role: 'doctor' as const,
      doctorId: d.id,
      active: true,
    })),
  ]

  return {
    generatedFor: today,
    specialties,
    doctors,
    leaveDays,
    patients,
    appointments,
    triage,
    staff,
    queue,
    sms,
    settings: {
      reminder: { ...DEFAULT_SETTINGS.reminder },
      booking: { ...DEFAULT_SETTINGS.booking },
    },
  }
}
