import type { Localized, Specialty } from './types.ts'

// Draft specialty guide: the client's specialties and the problems each one treats. It is the
// starting point for the "Specialty guide and AI test set" deliverable, which the client's doctors
// review and approve. The mock AI assistant classifies problems with these keywords.

export const SPECIALTIES: Specialty[] = [
  {
    id: 'medicine',
    name: { en: 'Medicine', bn: 'মেডিসিন' },
    description: {
      en: 'Fever, weakness, general health problems and first check-ups.',
      bn: 'জ্বর, দুর্বলতা, সাধারণ স্বাস্থ্য সমস্যা ও প্রাথমিক পরীক্ষা।',
    },
  },
  {
    id: 'cardiology',
    name: { en: 'Cardiology', bn: 'হৃদরোগ' },
    description: {
      en: 'Heart problems, high blood pressure and palpitations.',
      bn: 'হৃদযন্ত্রের সমস্যা, উচ্চ রক্তচাপ ও বুক ধড়ফড়।',
    },
  },
  {
    id: 'neurology',
    name: { en: 'Neurology', bn: 'স্নায়ুরোগ' },
    description: {
      en: 'Headache, migraine, dizziness, numbness and nerve problems.',
      bn: 'মাথাব্যথা, মাইগ্রেন, মাথা ঘোরা, অবশ ভাব ও স্নায়ুর সমস্যা।',
    },
  },
  {
    id: 'gastroenterology',
    name: { en: 'Gastroenterology & Liver', bn: 'পরিপাকতন্ত্র ও লিভার' },
    description: {
      en: 'Stomach pain, acidity, diarrhoea, constipation, jaundice and liver problems.',
      bn: 'পেট ব্যথা, গ্যাস্ট্রিক, ডায়রিয়া, কোষ্ঠকাঠিন্য, জন্ডিস ও লিভারের সমস্যা।',
    },
  },
  {
    id: 'orthopedics',
    name: { en: 'Orthopaedics', bn: 'অর্থোপেডিক্স' },
    description: {
      en: 'Bone, joint, back and neck pain, fractures and injuries.',
      bn: 'হাড়, জোড়া, কোমর ও ঘাড়ের ব্যথা, হাড় ভাঙা ও আঘাত।',
    },
  },
  {
    id: 'gynecology',
    name: { en: 'Gynaecology & Obstetrics', bn: 'স্ত্রীরোগ ও প্রসূতি' },
    description: {
      en: "Periods, pregnancy and women's health.",
      bn: 'মাসিক, গর্ভাবস্থা ও নারীস্বাস্থ্য।',
    },
  },
  {
    id: 'pediatrics',
    name: { en: 'Paediatrics', bn: 'শিশুরোগ' },
    description: {
      en: 'Health problems of babies and children.',
      bn: 'নবজাতক ও শিশুদের স্বাস্থ্য সমস্যা।',
    },
  },
  {
    id: 'ent',
    name: { en: 'ENT (Ear, Nose & Throat)', bn: 'নাক, কান ও গলা' },
    description: {
      en: 'Ear pain, hearing loss, sinus, tonsils and throat problems.',
      bn: 'কানে ব্যথা, কম শোনা, সাইনাস, টনসিল ও গলার সমস্যা।',
    },
  },
  {
    id: 'dermatology',
    name: { en: 'Dermatology', bn: 'চর্মরোগ' },
    description: {
      en: 'Skin rashes, itching, acne, allergies and hair loss.',
      bn: 'চামড়ায় ফুসকুড়ি, চুলকানি, ব্রণ, এলার্জি ও চুল পড়া।',
    },
  },
  {
    id: 'respiratory',
    name: { en: 'Respiratory Medicine', bn: 'বক্ষব্যাধি' },
    description: {
      en: 'Long-lasting cough, asthma, wheezing and lung problems.',
      bn: 'দীর্ঘদিনের কাশি, হাঁপানি, বুকে সাঁই সাঁই শব্দ ও ফুসফুসের সমস্যা।',
    },
  },
  {
    id: 'endocrinology',
    name: { en: 'Diabetes & Endocrinology', bn: 'ডায়াবেটিস ও হরমোন' },
    description: {
      en: 'Diabetes, thyroid and hormone problems.',
      bn: 'ডায়াবেটিস, থাইরয়েড ও হরমোনের সমস্যা।',
    },
  },
  {
    id: 'ophthalmology',
    name: { en: 'Eye (Ophthalmology)', bn: 'চক্ষু' },
    description: {
      en: 'Eye pain, redness and blurred vision.',
      bn: 'চোখে ব্যথা, চোখ লাল হওয়া ও ঝাপসা দেখা।',
    },
  },
  {
    id: 'psychiatry',
    name: { en: 'Psychiatry', bn: 'মানসিক স্বাস্থ্য' },
    description: {
      en: 'Anxiety, low mood, sleep problems and stress.',
      bn: 'দুশ্চিন্তা, মন খারাপ, ঘুমের সমস্যা ও মানসিক চাপ।',
    },
  },
  {
    id: 'urology',
    name: { en: 'Kidney & Urology', bn: 'কিডনি ও মূত্ররোগ' },
    description: {
      en: 'Burning urine, kidney stones and prostate problems.',
      bn: 'প্রস্রাবে জ্বালাপোড়া, কিডনিতে পাথর ও প্রোস্টেটের সমস্যা।',
    },
  },
].map((s, i) => ({ ...s, sortOrder: i + 1, active: true }))

export interface SymptomDef {
  id: string
  label: Localized
  specialtyId: string
  /** Counts more than one ordinary symptom, e.g. "child" steers most problems to Paediatrics. */
  weight?: number
  keywords: string[]
}

// prettier-ignore
export const SYMPTOMS: SymptomDef[] = [
  // Medicine
  { id: 'fever', label: { en: 'fever', bn: 'জ্বর' }, specialtyId: 'medicine', keywords: ['fever', 'temperature', 'jor', 'jwor', 'জ্বর'] },
  { id: 'weakness', label: { en: 'weakness', bn: 'দুর্বলতা' }, specialtyId: 'medicine', keywords: ['weakness', 'weak', 'tired', 'fatigue', 'durbol', 'দুর্বল', 'ক্লান্ত'] },
  { id: 'cold_flu', label: { en: 'cold or flu', bn: 'সর্দি-কাশি' }, specialtyId: 'medicine', keywords: ['cold', 'flu', 'runny nose', 'sneezing', 'sordi', 'সর্দি', 'ঠান্ডা লেগেছে'] },
  { id: 'body_ache', label: { en: 'body ache', bn: 'শরীর ব্যথা' }, specialtyId: 'medicine', keywords: ['body ache', 'body pain', 'গা ব্যথা', 'শরীর ব্যথা'] },
  // Cardiology
  { id: 'high_bp', label: { en: 'high blood pressure', bn: 'উচ্চ রক্তচাপ' }, specialtyId: 'cardiology', keywords: ['blood pressure', 'high pressure', 'hypertension', 'bp', 'pressure', 'প্রেশার', 'রক্তচাপ'] },
  { id: 'palpitations', label: { en: 'palpitations', bn: 'বুক ধড়ফড়' }, specialtyId: 'cardiology', keywords: ['palpitation', 'heart racing', 'heart beating fast', 'irregular heartbeat', 'ধড়ফড়'] },
  { id: 'heart', label: { en: 'a heart problem', bn: 'হৃদযন্ত্রের সমস্যা' }, specialtyId: 'cardiology', keywords: ['heart', 'হার্ট', 'হৃদ'] },
  // Neurology
  { id: 'headache', label: { en: 'headache', bn: 'মাথাব্যথা' }, specialtyId: 'neurology', keywords: ['headache', 'head ache', 'head pain', 'migraine', 'matha betha', 'matha batha', 'মাথাব্যথা', 'মাথা ব্যথা', 'মাথায় ব্যথা', 'মাইগ্রেন'] },
  { id: 'dizziness', label: { en: 'dizziness', bn: 'মাথা ঘোরা' }, specialtyId: 'neurology', keywords: ['dizzy', 'dizziness', 'vertigo', 'matha ghora', 'মাথা ঘোরা', 'মাথা ঘুরছে', 'মাথা ঘোরে'] },
  { id: 'numbness', label: { en: 'numbness or tingling', bn: 'অবশ বা ঝিঁঝি ভাব' }, specialtyId: 'neurology', keywords: ['numb', 'numbness', 'tingling', 'pins and needles', 'অবশ', 'ঝিঁঝি'] },
  // Gastroenterology
  { id: 'stomach_pain', label: { en: 'stomach pain', bn: 'পেট ব্যথা' }, specialtyId: 'gastroenterology', keywords: ['stomach pain', 'stomach ache', 'stomachache', 'abdominal pain', 'tummy', 'stomach', 'pet betha', 'pete betha', 'পেট ব্যথা', 'পেটে ব্যথা', 'পেটব্যথা', 'পেট'] },
  { id: 'acidity', label: { en: 'acidity', bn: 'গ্যাস্ট্রিক' }, specialtyId: 'gastroenterology', keywords: ['acidity', 'gastric', 'heartburn', 'indigestion', 'bloating', 'gas', 'অ্যাসিডিটি', 'এসিডিটি', 'গ্যাস্ট্রিক', 'বুক জ্বালা', 'বদহজম'] },
  { id: 'diarrhea', label: { en: 'diarrhoea', bn: 'ডায়রিয়া' }, specialtyId: 'gastroenterology', keywords: ['diarrhea', 'diarrhoea', 'loose motion', 'dysentery', 'ডায়রিয়া', 'পাতলা পায়খানা', 'আমাশয়'] },
  { id: 'vomiting', label: { en: 'vomiting', bn: 'বমি' }, specialtyId: 'gastroenterology', keywords: ['vomit', 'vomiting', 'nausea', 'bomi', 'বমি'] },
  { id: 'constipation', label: { en: 'constipation', bn: 'কোষ্ঠকাঠিন্য' }, specialtyId: 'gastroenterology', keywords: ['constipation', 'কোষ্ঠকাঠিন্য'] },
  { id: 'jaundice', label: { en: 'jaundice or liver problem', bn: 'জন্ডিস বা লিভারের সমস্যা' }, specialtyId: 'gastroenterology', keywords: ['jaundice', 'liver', 'hepatitis', 'জন্ডিস', 'লিভার'] },
  // Orthopaedics
  { id: 'back_pain', label: { en: 'back pain', bn: 'কোমর ব্যথা' }, specialtyId: 'orthopedics', keywords: ['back pain', 'backache', 'lower back', 'komor betha', 'কোমর ব্যথা', 'কোমরে ব্যথা', 'পিঠে ব্যথা', 'পিঠ ব্যথা'] },
  { id: 'joint_pain', label: { en: 'joint pain', bn: 'জোড়ায় ব্যথা' }, specialtyId: 'orthopedics', keywords: ['joint pain', 'knee pain', 'knee', 'arthritis', 'shoulder pain', 'hip pain', 'জয়েন্ট', 'হাঁটু', 'গিরা', 'বাতের', 'বাত ব্যথা'] },
  { id: 'neck_pain', label: { en: 'neck pain', bn: 'ঘাড় ব্যথা' }, specialtyId: 'orthopedics', keywords: ['neck pain', 'stiff neck', 'ঘাড় ব্যথা', 'ঘাড়ে ব্যথা'] },
  { id: 'injury', label: { en: 'an injury', bn: 'আঘাত' }, specialtyId: 'orthopedics', keywords: ['fracture', 'broken bone', 'sprain', 'injury', 'hurt my', 'হাড় ভাঙা', 'হাড় ভেঙে', 'মচকে', 'আঘাত'] },
  // Gynaecology
  { id: 'periods', label: { en: 'period problems', bn: 'মাসিকের সমস্যা' }, specialtyId: 'gynecology', keywords: ['period', 'menstrual', 'menstruation', 'white discharge', 'masik', 'মাসিক', 'পিরিয়ড', 'সাদা স্রাব'] },
  { id: 'pregnancy', label: { en: 'pregnancy', bn: 'গর্ভাবস্থা' }, specialtyId: 'gynecology', keywords: ['pregnant', 'pregnancy', 'antenatal', 'গর্ভবতী', 'গর্ভাবস্থা', 'প্রেগন্যান্ট', 'অন্তঃসত্ত্বা'] },
  // Paediatrics
  { id: 'child', label: { en: "a child's health", bn: 'শিশুর স্বাস্থ্য' }, specialtyId: 'pediatrics', weight: 2, keywords: ['child', 'children', 'baby', 'infant', 'toddler', 'newborn', 'my son', 'my daughter', 'kid', 'bachcha', 'baccha', 'বাচ্চা', 'শিশু', 'নবজাতক', 'আমার ছেলে', 'আমার মেয়ে'] },
  // ENT
  { id: 'ear', label: { en: 'ear problems', bn: 'কানের সমস্যা' }, specialtyId: 'ent', keywords: ['ear', 'earache', 'hearing', 'ringing in', 'কানে', 'কানের', 'কান ব্যথা', 'কান দিয়ে', 'কম শুনি'] },
  { id: 'nose_sinus', label: { en: 'nose or sinus problems', bn: 'নাক বা সাইনাসের সমস্যা' }, specialtyId: 'ent', keywords: ['blocked nose', 'nose', 'sinus', 'nosebleed', 'নাকে', 'নাক বন্ধ', 'নাক দিয়ে', 'নাকের', 'সাইনাস'] },
  { id: 'throat', label: { en: 'throat problems', bn: 'গলার সমস্যা' }, specialtyId: 'ent', keywords: ['sore throat', 'throat', 'tonsil', 'voice', 'gola betha', 'গলা', 'গলায়', 'টনসিল'] },
  // Dermatology
  { id: 'skin', label: { en: 'skin problems', bn: 'চর্মরোগ' }, specialtyId: 'dermatology', keywords: ['skin', 'rash', 'itch', 'itchy', 'itching', 'acne', 'pimple', 'eczema', 'allergy', 'chulkani', 'চুলকানি', 'চুলকায়', 'ফুসকুড়ি', 'ব্রণ', 'চর্ম', 'চামড়া', 'এলার্জি', 'অ্যালার্জি'] },
  { id: 'hair_loss', label: { en: 'hair loss', bn: 'চুল পড়া' }, specialtyId: 'dermatology', keywords: ['hair fall', 'hair loss', 'hair falling', 'dandruff', 'চুল পড়া', 'চুল পড়ে', 'খুশকি'] },
  // Respiratory
  { id: 'cough', label: { en: 'cough', bn: 'কাশি' }, specialtyId: 'respiratory', keywords: ['cough', 'coughing', 'asthma', 'wheezing', 'wheeze', 'kashi', 'কাশি', 'হাঁপানি', 'অ্যাজমা'] },
  // Endocrinology
  { id: 'diabetes', label: { en: 'diabetes', bn: 'ডায়াবেটিস' }, specialtyId: 'endocrinology', keywords: ['diabetes', 'diabetic', 'blood sugar', 'sugar', 'ডায়াবেটিস', 'ডায়াবেটিক', 'সুগার'] },
  { id: 'thyroid', label: { en: 'thyroid problems', bn: 'থাইরয়েডের সমস্যা' }, specialtyId: 'endocrinology', keywords: ['thyroid', 'hormone', 'থাইরয়েড', 'হরমোন'] },
  // Ophthalmology
  { id: 'eye', label: { en: 'eye problems', bn: 'চোখের সমস্যা' }, specialtyId: 'ophthalmology', keywords: ['eye', 'vision', 'blurry', 'blurred', 'red eye', 'chokh', 'চোখ', 'দৃষ্টি', 'ঝাপসা'] },
  // Psychiatry
  { id: 'anxiety', label: { en: 'anxiety or low mood', bn: 'দুশ্চিন্তা বা মন খারাপ' }, specialtyId: 'psychiatry', keywords: ['anxiety', 'anxious', 'depression', 'depressed', 'panic', 'stress', 'low mood', 'দুশ্চিন্তা', 'বিষণ্ণ', 'হতাশ', 'মানসিক চাপ', 'মন খারাপ'] },
  { id: 'sleep', label: { en: 'sleep problems', bn: 'ঘুমের সমস্যা' }, specialtyId: 'psychiatry', keywords: ["can't sleep", 'cannot sleep', 'insomnia', 'sleep problem', 'ঘুম হয় না', 'ঘুম আসে না', 'অনিদ্রা'] },
  // Urology
  { id: 'urine', label: { en: 'urine or kidney problems', bn: 'প্রস্রাব বা কিডনির সমস্যা' }, specialtyId: 'urology', keywords: ['urine', 'urination', 'urinating', 'passing water', 'kidney', 'kidney stone', 'prostate', 'প্রস্রাব', 'প্রসাব', 'কিডনি', 'পাথর'] },
]

export const SPECIALTY_BY_ID: ReadonlyMap<string, Specialty> = new Map(
  SPECIALTIES.map((s) => [s.id, s]),
)

export const SYMPTOM_BY_ID: ReadonlyMap<string, SymptomDef> = new Map(
  SYMPTOMS.map((s) => [s.id, s]),
)
