# Sample & Seed Data Reference

Complete inventory of all static, seed, and generated sample data currently defined in the repository.

**Source files:**

- [`packages/shared/src/sample-data.ts`](../packages/shared/src/sample-data.ts) — doctors, staff accounts, patient name pools, sample problems/emergencies, leave-day rules, default settings, and seeded generator
- [`packages/shared/src/specialty-guide.ts`](../packages/shared/src/specialty-guide.ts) — specialties and symptom keyword definitions
- [`packages/shared/src/emergency.ts`](../packages/shared/src/emergency.ts) — emergency keyword phrases
- [`packages/shared/src/triage-mock.ts`](../packages/shared/src/triage-mock.ts) — follow-up questions, quick replies, urgency tags
- [`packages/shared/src/constants.ts`](../packages/shared/src/constants.ts) — system constants
- [`packages/shared/src/sms.ts`](../packages/shared/src/sms.ts) — SMS message templates
- [`apps/web/src/mocks/backend.ts`](../apps/web/src/mocks/backend.ts) — mock voice transcripts

---

## 1. System Constants & Default Settings

| Key                                   | Value   | Notes                                                   |
| ------------------------------------- | ------- | ------------------------------------------------------- |
| `HOLD_MINUTES`                        | `5`     | Minutes a chosen slot is held before expiry             |
| `MAX_FOLLOW_UPS`                      | `3`     | Maximum AI assistant follow-up questions                |
| `DEFAULT_OPEN_DAYS`                   | `14`    | Default booking window (days ahead)                     |
| `DEFAULT_CLOSE_MINUTES_BEFORE`        | `60`    | Minutes before a session online booking closes          |
| `EMERGENCY_NUMBER`                    | `999`   | National emergency number                               |
| `settings.reminder.daysBefore`        | `1`     | `1` = day before, `0` = same day                        |
| `settings.reminder.time`              | `19:00` | Asia/Dhaka time                                         |
| `settings.booking.openDays`           | `14`    | Editable up to 1–60 days                                |
| `settings.booking.closeMinutesBefore` | `60`    | Minutes before session start when online booking closes |

---

## 2. Specialties (14)

All 14 specialties start with `active: true` and `sortOrder: 1..14`.

| Order | ID                 | Name (EN)                | Name (BN)            | Description (EN)                                                             | Description (BN)                                                          |
| ----: | ------------------ | ------------------------ | -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
|     1 | `medicine`         | Medicine                 | মেডিসিন              | Fever, weakness, general health problems and first check-ups.                | জ্বর, দুর্বলতা, সাধারণ স্বাস্থ্য সমস্যা ও প্রাথমিক পরীক্ষা।               |
|     2 | `cardiology`       | Cardiology               | হৃদরোগ               | Heart problems, high blood pressure and palpitations.                        | হৃদযন্ত্রের সমস্যা, উচ্চ রক্তচাপ ও বুক ধড়ফড়।                            |
|     3 | `neurology`        | Neurology                | স্নায়ুরোগ           | Headache, migraine, dizziness, numbness and nerve problems.                  | মাথাব্যথা, মাইগ্রেন, মাথা ঘোরা, অবশ ভাব ও স্নায়ুর সমস্যা।                |
|     4 | `gastroenterology` | Gastroenterology & Liver | পরিপাকতন্ত্র ও লিভার | Stomach pain, acidity, diarrhoea, constipation, jaundice and liver problems. | পেট ব্যথা, গ্যাস্ট্রিক, ডায়রিয়া, কোষ্ঠকাঠিন্য, জন্ডিস ও লিভারের সমস্যা। |
|     5 | `orthopedics`      | Orthopaedics             | অর্থোপেডিক্স         | Bone, joint, back and neck pain, fractures and injuries.                     | হাড়, জোড়া, কোমর ও ঘাড়ের ব্যথা, হাড় ভাঙা ও আঘাত।                       |
|     6 | `gynecology`       | Gynaecology & Obstetrics | স্ত্রীরোগ ও প্রসূতি  | Periods, pregnancy and women's health.                                       | মাসিক, গর্ভাবস্থা ও নারীস্বাস্থ্য।                                        |
|     7 | `pediatrics`       | Paediatrics              | শিশুরোগ              | Health problems of babies and children.                                      | নবজাতক ও শিশুদের স্বাস্থ্য সমস্যা।                                        |
|     8 | `ent`              | ENT (Ear, Nose & Throat) | নাক, কান ও গলা       | Ear pain, hearing loss, sinus, tonsils and throat problems.                  | কানে ব্যথা, কম শোনা, সাইনাস, টনসিল ও গলার সমস্যা।                         |
|     9 | `dermatology`      | Dermatology              | চর্মরোগ              | Skin rashes, itching, acne, allergies and hair loss.                         | চামড়ায় ফুসকুড়ি, চুলকানি, ব্রণ, এলার্জি ও চুল পড়া।                     |
|    10 | `respiratory`      | Respiratory Medicine     | বক্ষব্যাধি           | Long-lasting cough, asthma, wheezing and lung problems.                      | দীর্ঘদিনের কাশি, হাঁপানি, বুকে সাঁই সাঁই শব্দ ও ফুসফুসের সমস্যা।          |
|    11 | `endocrinology`    | Diabetes & Endocrinology | ডায়াবেটিস ও হরমোন   | Diabetes, thyroid and hormone problems.                                      | ডায়াবেটিস, থাইরয়েড ও হরমোনের সমস্যা।                                    |
|    12 | `ophthalmology`    | Eye (Ophthalmology)      | চক্ষু                | Eye pain, redness and blurred vision.                                        | চোখে ব্যথা, চোখ লাল হওয়া ও ঝাপসা দেখা।                                   |
|    13 | `psychiatry`       | Psychiatry               | মানসিক স্বাস্থ্য     | Anxiety, low mood, sleep problems and stress.                                | দুশ্চিন্তা, মন খারাপ, ঘুমের সমস্যা ও মানসিক চাপ।                          |
|    14 | `urology`          | Kidney & Urology         | কিডনি ও মূত্ররোগ     | Burning urine, kidney stones and prostate problems.                          | প্রস্রাবে জ্বালাপোড়া, কিডনিতে পাথর ও প্রোস্টেটের সমস্যা।                 |

---

## 3. Doctors (22)

All 22 doctors are invented names, start with `active: true`, and have Friday as a weekly holiday.
Designations are localized with:

- `Senior Consultant` → `সিনিয়র কনসালট্যান্ট`
- `Consultant` → `কনসালট্যান্ট`
- `Associate Consultant` → `অ্যাসোসিয়েট কনসালট্যান্ট`

| ID    | Name (EN)             | Name (BN)          | Gender | Specialty          | Designation          | Qualifications                               | Exp (yrs) | Fee (BDT) | Room     | Weekly Schedule (`Days · Start–End · Slot min · Max pts`)                      |
| ----- | --------------------- | ------------------ | ------ | ------------------ | -------------------- | -------------------------------------------- | --------: | --------: | -------- | ------------------------------------------------------------------------------ |
| `d01` | Dr. Mahmudul Hasan    | ডা. মাহমুদুল হাসান | male   | `medicine`         | Senior Consultant    | MBBS, FCPS (Medicine)                        |        18 |      1000 | Room 101 | Sun, Tue, Thu · 17:00–21:00 · 12m · max 20                                     |
| `d02` | Dr. Sharmin Akter     | ডা. শারমিন আক্তার  | female | `medicine`         | Consultant           | MBBS, FCPS (Medicine)                        |         9 |       800 | Room 102 | Sat, Mon, Wed · 10:00–13:00 · 10m · max 18                                     |
| `d03` | Dr. Arifur Rahman     | ডা. আরিফুর রহমান   | male   | `medicine`         | Consultant           | MBBS, MD (Internal Medicine)                 |        10 |       900 | Room 103 | Sat, Mon, Wed · 17:00–21:00 · 12m · max 20                                     |
| `d04` | Dr. Rezaul Karim      | ডা. রেজাউল করিম    | male   | `cardiology`       | Senior Consultant    | MBBS, MD (Cardiology)                        |        22 |      1500 | Room 201 | Sat, Mon, Wed · 18:00–21:00 · 15m · max 12                                     |
| `d05` | Dr. Nadia Islam       | ডা. নাদিয়া ইসলাম  | female | `cardiology`       | Consultant           | MBBS, MD (Cardiology)                        |        11 |      1200 | Room 202 | Sun, Tue · 10:00–13:00 · 15m · max 12                                          |
| `d06` | Dr. Anisur Rahman     | ডা. আনিসুর রহমান   | male   | `neurology`        | Consultant           | MBBS, MD (Neurology)                         |        14 |      1200 | Room 203 | Sun, Wed · 17:00–20:00 · 15m · max 12                                          |
| `d07` | Dr. Lubna Yasmin      | ডা. লুবনা ইয়াসমিন | female | `neurology`        | Associate Consultant | MBBS, MD (Neurology)                         |         7 |      1000 | Room 204 | Sat, Mon · 10:00–13:00 · 15m · max 12                                          |
| `d08` | Dr. Tanvir Hasan      | ডা. তানভীর হাসান   | male   | `gastroenterology` | Consultant           | MBBS, MD (Gastroenterology)                  |        12 |      1000 | Room 301 | Sat, Mon, Thu · 17:30–20:30 · 12m · max 15<br>Thu · 10:00–12:00 · 12m · max 10 |
| `d09` | Dr. Farzana Chowdhury | ডা. ফারজানা চৌধুরী | female | `gastroenterology` | Associate Consultant | MBBS, FCPS (Medicine), MD (Gastroenterology) |         8 |       900 | Room 302 | Sun, Tue · 10:00–12:30 · 10m · max 15                                          |
| `d10` | Dr. Kamrul Islam      | ডা. কামরুল ইসলাম   | male   | `orthopedics`      | Senior Consultant    | MBBS, MS (Orthopaedics)                      |        20 |      1200 | Room 303 | Sat, Tue, Thu · 16:00–20:00 · 15m · max 16                                     |
| `d11` | Dr. Sabrina Haque     | ডা. সাবরিনা হক     | female | `orthopedics`      | Consultant           | MBBS, MS (Orthopaedics)                      |         7 |      1000 | Room 304 | Mon, Wed · 10:30–13:00 · 15m · max 10                                          |
| `d12` | Dr. Rokeya Begum      | ডা. রোকেয়া বেগম   | female | `gynecology`       | Senior Consultant    | MBBS, FCPS (Gynae & Obs)                     |        21 |      1200 | Room 401 | Sat, Mon, Wed · 16:00–20:00 · 12m · max 20                                     |
| `d13` | Dr. Tahmina Ahmed     | ডা. তাহমিনা আহমেদ  | female | `gynecology`       | Consultant           | MBBS, FCPS (Gynae & Obs)                     |        10 |      1000 | Room 402 | Sun, Tue, Thu · 10:00–13:00 · 12m · max 15                                     |
| `d14` | Dr. Shafiqul Alam     | ডা. শফিকুল আলম     | male   | `pediatrics`       | Senior Consultant    | MBBS, FCPS (Paediatrics)                     |        16 |      1000 | Room 403 | Sat, Sun, Tue, Thu · 17:00–20:00 · 10m · max 18                                |
| `d15` | Dr. Ishrat Jahan      | ডা. ইশরাত জাহান    | female | `pediatrics`       | Consultant           | MBBS, DCH, FCPS (Paediatrics)                |         9 |       900 | Room 404 | Mon, Wed · 10:00–13:00 · 10m · max 18                                          |
| `d16` | Dr. Abdul Mannan      | ডা. আবদুল মান্নান  | male   | `ent`              | Consultant           | MBBS, DLO, FCPS (ENT)                        |        15 |      1000 | Room 501 | Sun, Tue, Thu · 17:00–20:00 · 12m · max 15                                     |
| `d17` | Dr. Sumaiya Rahman    | ডা. সুমাইয়া রহমান | female | `dermatology`      | Consultant           | MBBS, DDV, FCPS (Dermatology)                |         8 |      1000 | Room 502 | Sat, Mon, Wed · 17:00–20:00 · 10m · max 18                                     |
| `d18` | Dr. Mizanur Rahman    | ডা. মিজানুর রহমান  | male   | `respiratory`      | Senior Consultant    | MBBS, FCPS (Medicine), MD (Chest)            |        19 |      1200 | Room 503 | Sun, Wed · 17:00–20:00 · 15m · max 12                                          |
| `d19` | Dr. Shahana Parvin    | ডা. শাহানা পারভীন  | female | `endocrinology`    | Consultant           | MBBS, MD (Endocrinology)                     |        13 |      1200 | Room 504 | Sat, Tue, Thu · 10:00–13:00 · 15m · max 12                                     |
| `d20` | Dr. Jahangir Alam     | ডা. জাহাঙ্গীর আলম  | male   | `ophthalmology`    | Consultant           | MBBS, FCPS (Ophthalmology)                   |        17 |       900 | Room 601 | Sat, Mon, Wed · 16:00–19:00 · 10m · max 18                                     |
| `d21` | Dr. Rafiqul Islam     | ডা. রফিকুল ইসলাম   | male   | `psychiatry`       | Consultant           | MBBS, FCPS (Psychiatry)                      |        12 |      1200 | Room 602 | Tue, Thu · 17:00–20:00 · 20m · max 9                                           |
| `d22` | Dr. Moinul Hossain    | ডা. মঈনুল হোসেন    | male   | `urology`          | Consultant           | MBBS, MS (Urology)                           |        14 |      1200 | Room 603 | Sun, Wed · 18:00–21:00 · 15m · max 12                                          |

---

## 4. Staff Accounts (24)

| ID    | Name                  | Username      | Password (demo) | Role         | Linked Doctor |
| ----- | --------------------- | ------------- | --------------- | ------------ | ------------- |
| `u1`  | Hospital Admin        | `admin`       | `admin123`      | `admin`      | —             |
| `u2`  | Front Desk            | `frontdesk`   | `frontdesk123`  | `front_desk` | —             |
| `u3`  | Dr. Mahmudul Hasan    | `dr.mahmudul` | `doctor123`     | `doctor`     | `d01`         |
| `u4`  | Dr. Sharmin Akter     | `dr.sharmin`  | `doctor123`     | `doctor`     | `d02`         |
| `u5`  | Dr. Arifur Rahman     | `dr.arifur`   | `doctor123`     | `doctor`     | `d03`         |
| `u6`  | Dr. Rezaul Karim      | `dr.rezaul`   | `doctor123`     | `doctor`     | `d04`         |
| `u7`  | Dr. Nadia Islam       | `dr.nadia`    | `doctor123`     | `doctor`     | `d05`         |
| `u8`  | Dr. Anisur Rahman     | `dr.anisur`   | `doctor123`     | `doctor`     | `d06`         |
| `u9`  | Dr. Lubna Yasmin      | `dr.lubna`    | `doctor123`     | `doctor`     | `d07`         |
| `u10` | Dr. Tanvir Hasan      | `dr.tanvir`   | `doctor123`     | `doctor`     | `d08`         |
| `u11` | Dr. Farzana Chowdhury | `dr.farzana`  | `doctor123`     | `doctor`     | `d09`         |
| `u12` | Dr. Kamrul Islam      | `dr.kamrul`   | `doctor123`     | `doctor`     | `d10`         |
| `u13` | Dr. Sabrina Haque     | `dr.sabrina`  | `doctor123`     | `doctor`     | `d11`         |
| `u14` | Dr. Rokeya Begum      | `dr.rokeya`   | `doctor123`     | `doctor`     | `d12`         |
| `u15` | Dr. Tahmina Ahmed     | `dr.tahmina`  | `doctor123`     | `doctor`     | `d13`         |
| `u16` | Dr. Shafiqul Alam     | `dr.shafiqul` | `doctor123`     | `doctor`     | `d14`         |
| `u17` | Dr. Ishrat Jahan      | `dr.ishrat`   | `doctor123`     | `doctor`     | `d15`         |
| `u18` | Dr. Abdul Mannan      | `dr.abdul`    | `doctor123`     | `doctor`     | `d16`         |
| `u19` | Dr. Sumaiya Rahman    | `dr.sumaiya`  | `doctor123`     | `doctor`     | `d17`         |
| `u20` | Dr. Mizanur Rahman    | `dr.mizanur`  | `doctor123`     | `doctor`     | `d18`         |
| `u21` | Dr. Shahana Parvin    | `dr.shahana`  | `doctor123`     | `doctor`     | `d19`         |
| `u22` | Dr. Jahangir Alam     | `dr.jahangir` | `doctor123`     | `doctor`     | `d20`         |
| `u23` | Dr. Rafiqul Islam     | `dr.rafiqul`  | `doctor123`     | `doctor`     | `d21`         |
| `u24` | Dr. Moinul Hossain    | `dr.moinul`   | `doctor123`     | `doctor`     | `d22`         |

---

## 5. Seeded Leave Days (4)

Generated relative to `today` (Dhaka date), choosing the first scheduled chamber day starting from the offset:

| ID   | Doctor                     | Offset from Today              | Reason              |
| ---- | -------------------------- | ------------------------------ | ------------------- |
| `l1` | `d04` (Dr. Rezaul Karim)   | First chamber day ≥ `-40` days | `Conference`        |
| `l2` | `d10` (Dr. Kamrul Islam)   | First chamber day ≥ `-20` days | `Personal`          |
| `l3` | `d06` (Dr. Anisur Rahman)  | First chamber day ≥ `+5` days  | `Conference abroad` |
| `l4` | `d17` (Dr. Sumaiya Rahman) | First chamber day ≥ `+9` days  | `Personal`          |

---

## 6. Patients Generator Pools (500 Generated)

500 patients (`p0001`–`p0500`) are deterministically generated per day using a mulberry32 PRNG seeded from `today`:

- **Sex:** 52% `female`, 48% `male`
- **Age:** 18% aged `1–14`, 82% aged `18–78`
- **Phone:** Unique 11-digit Bangladeshi mobile numbers matching `01[3-9]XXXXXXXX`
- **Registered by:** 80% `self`, 20% `front_desk`
- **Name format:** 8% Bangla script names, 92% English `First + Last` names

| Pool                   | Values                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FIRST_MALE` (24)      | Rahim, Karim, Hasan, Tariq, Arif, Sakib, Rafiq, Jamal, Kamal, Nayeem, Imran, Shafiq, Mahmud, Rashed, Sohel, Fahim, Masud, Habib, Rakib, Zahid, Faisal, Mizan, Anwar, Babul |
| `FIRST_FEMALE` (22)    | Fatema, Ayesha, Nasima, Sumi, Sumaiya, Shirin, Rumana, Nasrin, Sadia, Jannat, Mim, Tania, Rokeya, Salma, Parvin, Lima, Rina, Moushumi, Afroza, Dilruba, Kulsum, Shapla     |
| `LAST` (16)            | Ahmed, Hossain, Rahman, Islam, Khan, Chowdhury, Uddin, Miah, Sarker, Das, Roy, Biswas, Talukder, Siddiqui, Mondal, Sheikh                                                  |
| `LAST_FEMALE_ONLY` (3) | Akter, Begum, Khatun                                                                                                                                                       |
| `BN_NAMES_MALE` (4)    | রহিম উদ্দিন, আবুল কালাম, জসিম মিয়া, মোস্তফা কামাল                                                                                                                         |
| `BN_NAMES_FEMALE` (4)  | ফাতেমা বেগম, নাসিমা আক্তার, শাহানা খাতুন, রাবেয়া খাতুন                                                                                                                    |

---

## 7. Sample Problems & Mock Transcripts

### 7.1 Sample Problem Descriptions (`SAMPLE_PROBLEMS`)

Used to generate pre-visit summaries for ~45% of online appointments and 260 additional unbooked triage conversations for analytics:

| Specialty          | Lang | Problem Text                                     |
| ------------------ | ---- | ------------------------------------------------ |
| `medicine`         | `en` | Fever and body ache for three days               |
| `medicine`         | `bn` | তিন দিন ধরে জ্বর আর শরীর ব্যথা                   |
| `medicine`         | `en` | Feeling weak and tired all the time              |
| `medicine`         | `bn` | খুব দুর্বল লাগে, সবসময় ক্লান্ত                  |
| `cardiology`       | `en` | My blood pressure is high and I get palpitations |
| `cardiology`       | `bn` | প্রেশার বেড়েছে, মাঝে মাঝে বুক ধড়ফড় করে        |
| `cardiology`       | `en` | Heart beating fast when I climb stairs           |
| `neurology`        | `en` | Headache every day and dizziness                 |
| `neurology`        | `bn` | প্রতিদিন মাথাব্যথা আর মাথা ঘোরা                  |
| `neurology`        | `en` | Numbness and tingling in my hands                |
| `gastroenterology` | `en` | Stomach pain and acidity after meals             |
| `gastroenterology` | `bn` | খাওয়ার পর পেট ব্যথা আর গ্যাস্ট্রিক              |
| `gastroenterology` | `en` | Loose motion and vomiting since yesterday        |
| `gastroenterology` | `bn` | জন্ডিস হয়েছে, খাবারে অরুচি                      |
| `orthopedics`      | `en` | Lower back pain for weeks                        |
| `orthopedics`      | `bn` | অনেক দিন ধরে কোমর ব্যথা                          |
| `orthopedics`      | `en` | Knee pain when climbing stairs                   |
| `orthopedics`      | `bn` | হাঁটুতে ব্যথা, হাঁটতে কষ্ট হয়                   |
| `gynecology`       | `en` | Irregular periods for a few months               |
| `gynecology`       | `bn` | কয়েক মাস ধরে মাসিক অনিয়মিত                     |
| `gynecology`       | `en` | I am pregnant and need a check-up                |
| `pediatrics`       | `en` | My child has fever and cough                     |
| `pediatrics`       | `bn` | বাচ্চার দুই দিন ধরে জ্বর আর কাশি                 |
| `pediatrics`       | `en` | My baby is not feeding well and has loose motion |
| `ent`              | `en` | Ear pain and blocked nose                        |
| `ent`              | `bn` | কানে ব্যথা আর কম শুনি                            |
| `ent`              | `en` | Sore throat and tonsil pain                      |
| `dermatology`      | `en` | Itchy skin rash on my arms                       |
| `dermatology`      | `bn` | চামড়ায় চুলকানি আর ফুসকুড়ি                     |
| `dermatology`      | `bn` | চুল পড়ে যাচ্ছে, খুশকি                           |
| `respiratory`      | `en` | Cough for a month and wheezing at night          |
| `respiratory`      | `bn` | অনেক দিনের কাশি আর হাঁপানি                       |
| `endocrinology`    | `en` | My blood sugar is not under control              |
| `endocrinology`    | `bn` | ডায়াবেটিস নিয়ন্ত্রণে নেই                       |
| `endocrinology`    | `en` | Thyroid problem and weight gain                  |
| `ophthalmology`    | `en` | Blurry vision and eye pain                       |
| `ophthalmology`    | `bn` | চোখে ঝাপসা দেখি, চোখ লাল                         |
| `psychiatry`       | `en` | Anxiety and I can't sleep at night               |
| `psychiatry`       | `bn` | দুশ্চিন্তা আর রাতে ঘুম হয় না                    |
| `urology`          | `en` | Burning when passing urine                       |
| `urology`          | `bn` | প্রস্রাবে জ্বালাপোড়া আর কোমরের পাশে ব্যথা       |
| `urology`          | `en` | Kidney stone pain on the right side              |

### 7.2 Sample Emergency Prompts (`SAMPLE_EMERGENCIES`)

4% of the 260 unbooked triage records pick from:

- `en`: `Sudden chest pain and sweating`
- `bn`: `হঠাৎ বুকে ব্যথা`
- `bn`: `শ্বাস নিতে কষ্ট হচ্ছে`

### 7.3 Mock Speech-to-Text Transcripts (`SAMPLE_TRANSCRIPTS`)

Returned by `POST /api/v1/speech/transcribe` in the mock backend:

- `en`: `I have had a headache and dizziness for three days`
- `bn`: `তিন দিন ধরে মাথাব্যথা আর মাথা ঘোরা`

---

## 8. Symptom Keywords Guide (`SYMPTOMS` — 35 Entries)

| ID             | Specialty          | Weight | Label (EN)                | Label (BN)                | Keywords                                                                                                                                                                           |
| -------------- | ------------------ | -----: | ------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fever`        | `medicine`         |      1 | fever                     | জ্বর                      | `fever`, `temperature`, `jor`, `jwor`, `জ্বর`                                                                                                                                      |
| `weakness`     | `medicine`         |      1 | weakness                  | দুর্বলতা                  | `weakness`, `weak`, `tired`, `fatigue`, `durbol`, `দুর্বল`, `ক্লান্ত`                                                                                                              |
| `cold_flu`     | `medicine`         |      1 | cold or flu               | সর্দি-কাশি                | `cold`, `flu`, `runny nose`, `sneezing`, `sordi`, `সর্দি`, `ঠান্ডা লেগেছে`                                                                                                         |
| `body_ache`    | `medicine`         |      1 | body ache                 | শরীর ব্যথা                | `body ache`, `body pain`, `গা ব্যথা`, `শরীর ব্যথা`                                                                                                                                 |
| `high_bp`      | `cardiology`       |      1 | high blood pressure       | উচ্চ রক্তচাপ              | `blood pressure`, `high pressure`, `hypertension`, `bp`, `pressure`, `প্রেশার`, `রক্তচাপ`                                                                                          |
| `palpitations` | `cardiology`       |      1 | palpitations              | বুক ধড়ফড়                | `palpitation`, `heart racing`, `heart beating fast`, `irregular heartbeat`, `ধড়ফড়`                                                                                               |
| `heart`        | `cardiology`       |      1 | a heart problem           | হৃদযন্ত্রের সমস্যা        | `heart`, `হার্ট`, `হৃদ`                                                                                                                                                            |
| `headache`     | `neurology`        |      1 | headache                  | মাথাব্যথা                 | `headache`, `head ache`, `head pain`, `migraine`, `matha betha`, `matha batha`, `মাথাব্যথা`, `মাথা ব্যথা`, `মাথায় ব্যথা`, `মাইগ্রেন`                                              |
| `dizziness`    | `neurology`        |      1 | dizziness                 | মাথা ঘোরা                 | `dizzy`, `dizziness`, `vertigo`, `matha ghora`, `মাথা ঘোরা`, `মাথা ঘুরছে`, `মাথা ঘোরে`                                                                                             |
| `numbness`     | `neurology`        |      1 | numbness or tingling      | অবশ বা ঝিঁঝি ভাব          | `numb`, `numbness`, `tingling`, `pins and needles`, `অবশ`, `ঝিঁঝি`                                                                                                                 |
| `stomach_pain` | `gastroenterology` |      1 | stomach pain              | পেট ব্যথা                 | `stomach pain`, `stomach ache`, `stomachache`, `abdominal pain`, `tummy`, `stomach`, `pet betha`, `pete betha`, `পেট ব্যথা`, `পেটে ব্যথা`, `পেটব্যথা`, `পেট`                       |
| `acidity`      | `gastroenterology` |      1 | acidity                   | গ্যাস্ট্রিক               | `acidity`, `gastric`, `heartburn`, `indigestion`, `bloating`, `gas`, `অ্যাসিডিটি`, `এসিডিটি`, `গ্যাস্ট্রিক`, `বুক জ্বালা`, `বদহজম`                                                 |
| `diarrhea`     | `gastroenterology` |      1 | diarrhoea                 | ডায়রিয়া                 | `diarrhea`, `diarrhoea`, `loose motion`, `dysentery`, `ডায়রিয়া`, `পাতলা পায়খানা`, `আমাশয়`                                                                                      |
| `vomiting`     | `gastroenterology` |      1 | vomiting                  | বমি                       | `vomit`, `vomiting`, `nausea`, `bomi`, `বমি`                                                                                                                                       |
| `constipation` | `gastroenterology` |      1 | constipation              | কোষ্ঠকাঠিন্য              | `constipation`, `কোষ্ঠকাঠিন্য`                                                                                                                                                     |
| `jaundice`     | `gastroenterology` |      1 | jaundice or liver problem | জন্ডিস বা লিভারের সমস্যা  | `jaundice`, `liver`, `hepatitis`, `জন্ডিস`, `লিভার`                                                                                                                                |
| `back_pain`    | `orthopedics`      |      1 | back pain                 | কোমর ব্যথা                | `back pain`, `backache`, `lower back`, `komor betha`, `কোমর ব্যথা`, `কোমরে ব্যথা`, `পিঠে ব্যথা`, `পিঠ ব্যথা`                                                                       |
| `joint_pain`   | `orthopedics`      |      1 | joint pain                | জোড়ায় ব্যথা             | `joint pain`, `knee pain`, `knee`, `arthritis`, `shoulder pain`, `hip pain`, `জয়েন্ট`, `হাঁটু`, `গিরা`, `বাতের`, `বাত ব্যথা`                                                      |
| `neck_pain`    | `orthopedics`      |      1 | neck pain                 | ঘাড় ব্যথা                | `neck pain`, `stiff neck`, `ঘাড় ব্যথা`, `ঘাড়ে ব্যথা`                                                                                                                             |
| `injury`       | `orthopedics`      |      1 | an injury                 | আঘাত                      | `fracture`, `broken bone`, `sprain`, `injury`, `hurt my`, `হাড় ভাঙা`, `হাড় ভেঙে`, `মচকে`, `আঘাত`                                                                                 |
| `periods`      | `gynecology`       |      1 | period problems           | মাসিকের সমস্যা            | `period`, `menstrual`, `menstruation`, `white discharge`, `masik`, `মাসিক`, `পিরিয়ড`, `সাদা স্রাব`                                                                                |
| `pregnancy`    | `gynecology`       |      1 | pregnancy                 | গর্ভাবস্থা                | `pregnant`, `pregnancy`, `antenatal`, `গর্ভবতী`, `গর্ভাবস্থা`, `প্রেগন্যান্ট`, `অন্তঃসত্ত্বা`                                                                                      |
| `child`        | `pediatrics`       |      2 | a child's health          | শিশুর স্বাস্থ্য           | `child`, `children`, `baby`, `infant`, `toddler`, `newborn`, `my son`, `my daughter`, `kid`, `bachcha`, `baccha`, `বাচ্চা`, `শিশু`, `নবজাতক`, `আমার ছেলে`, `আমার মেয়ে`            |
| `ear`          | `ent`              |      1 | ear problems              | কানের সমস্যা              | `ear`, `earache`, `hearing`, `ringing in`, `কানে`, `কানের`, `কান ব্যথা`, `কান দিয়ে`, `কম শুনি`                                                                                    |
| `nose_sinus`   | `ent`              |      1 | nose or sinus problems    | নাক বা সাইনাসের সমস্যা    | `blocked nose`, `nose`, `sinus`, `nosebleed`, `নাকে`, `নাক বন্ধ`, `নাক দিয়ে`, `নাকের`, `সাইনাস`                                                                                   |
| `throat`       | `ent`              |      1 | throat problems           | গলার সমস্যা               | `sore throat`, `throat`, `tonsil`, `voice`, `gola betha`, `গলা`, `গলায়`, `টনসিল`                                                                                                  |
| `skin`         | `dermatology`      |      1 | skin problems             | চর্মরোগ                   | `skin`, `rash`, `itch`, `itchy`, `itching`, `acne`, `pimple`, `eczema`, `allergy`, `chulkani`, `চুলকানি`, `চুলকায়`, `ফুসকুড়ি`, `ব্রণ`, `চর্ম`, `চামড়া`, `এলার্জি`, `অ্যালার্জি` |
| `hair_loss`    | `dermatology`      |      1 | hair loss                 | চুল পড়া                  | `hair fall`, `hair loss`, `hair falling`, `dandruff`, `চুল পড়া`, `চুল পড়ে`, `খুশকি`                                                                                              |
| `cough`        | `respiratory`      |      1 | cough                     | কাশি                      | `cough`, `coughing`, `asthma`, `wheezing`, `wheeze`, `kashi`, `কাশি`, `হাঁপানি`, `অ্যাজমা`                                                                                         |
| `diabetes`     | `endocrinology`    |      1 | diabetes                  | ডায়াবেটিস                | `diabetes`, `diabetic`, `blood sugar`, `sugar`, `ডায়াবেটিস`, `ডায়াবেটিক`, `সুগার`                                                                                                |
| `thyroid`      | `endocrinology`    |      1 | thyroid problems          | থাইরয়েডের সমস্যা         | `thyroid`, `hormone`, `থাইরয়েড`, `হরমোন`                                                                                                                                          |
| `eye`          | `ophthalmology`    |      1 | eye problems              | চোখের সমস্যা              | `eye`, `vision`, `blurry`, `blurred`, `red eye`, `chokh`, `চোখ`, `দৃষ্টি`, `ঝাপসা`                                                                                                 |
| `anxiety`      | `psychiatry`       |      1 | anxiety or low mood       | দুশ্চিন্তা বা মন খারাপ    | `anxiety`, `anxious`, `depression`, `depressed`, `panic`, `stress`, `low mood`, `দুশ্চিন্তা`, `বিষণ্ণ`, `হতাশ`, `মানসিক চাপ`, `মন খারাপ`                                           |
| `sleep`        | `psychiatry`       |      1 | sleep problems            | ঘুমের সমস্যা              | `can't sleep`, `cannot sleep`, `insomnia`, `sleep problem`, `ঘুম হয় না`, `ঘুম আসে না`, `অনিদ্রা`                                                                                  |
| `urine`        | `urology`          |      1 | urine or kidney problems  | প্রস্রাব বা কিডনির সমস্যা | `urine`, `urination`, `urinating`, `passing water`, `kidney`, `kidney stone`, `prostate`, `প্রস্রাব`, `প্রসাব`, `কিডনি`, `পাথর`                                                    |

**Urgent tags** (elevate `moderate` severity to `within_48h`): `fever`, `vomiting`, `diarrhea`, `jaundice`, `injury`, `pregnancy`.

---

## 9. Emergency Phrases (`EMERGENCY_PHRASES` — 78 Phrases)

- **English (42):** `chest pain`, `pain in my chest`, `pain in the chest`, `heart attack`, `can't breathe`, `cant breathe`, `cannot breathe`, `can not breathe`, `unable to breathe`, `difficulty breathing`, `difficulty in breathing`, `breathing difficulty`, `trouble breathing`, `short of breath`, `shortness of breath`, `heavy bleeding`, `bleeding heavily`, `severe bleeding`, `bleeding a lot`, `vomiting blood`, `coughing blood`, `coughing up blood`, `unconscious`, `fainted`, `passed out`, `not responding`, `seizure`, `convulsion`, `stroke`, `face drooping`, `slurred speech`, `paralysed`, `paralyzed`, `paralysis`, `suicide`, `kill myself`, `poisoning`, `swallowed poison`, `overdose`, `severe burn`, `snake bite`, `snakebite`
- **Bangla (28):** `বুকে ব্যথা`, `বুক ব্যথা`, `বুকের ব্যথা`, `বুকে চাপ`, `হার্ট অ্যাটাক`, `হার্ট এটাক`, `শ্বাস নিতে কষ্ট`, `শ্বাস নিতে পারছি না`, `শ্বাস নিতে পারছে না`, `শ্বাসকষ্ট`, `শ্বাস কষ্ট`, `দম বন্ধ`, `প্রচুর রক্তপাত`, `অনেক রক্ত`, `রক্ত বমি`, `রক্তক্ষরণ`, `কাশির সাথে রক্ত`, `অজ্ঞান`, `জ্ঞান হারিয়ে`, `খিঁচুনি`, `স্ট্রোক`, `প্যারালাইসিস`, `মুখ বেঁকে`, `আত্মহত্যা`, `বিষ খেয়ে`, `বিষ খেয়েছে`, `সাপে কামড়`, `পুড়ে গেছে`
- **Romanised Bangla (8):** `buke betha`, `buke batha`, `buk betha`, `shash kosto`, `shashkosto`, `sash kosto`, `onek rokto`, `ogyan`

---

## 10. Mock Triage Follow-Up Questions

| Kind       | Language | Question                                                                       | Quick Replies                                                 |
| ---------- | -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `detail`   | `en`     | Could you tell me a bit more? Where is the problem, and what else do you feel? | _(free text)_                                                 |
| `detail`   | `bn`     | আরেকটু বিস্তারিত বলবেন? সমস্যাটা কোথায়, আর কী কী অনুভব করছেন?                 | _(free text)_                                                 |
| `duration` | `en`     | How long have you had this problem?                                            | `Since today`, `A few days`, `1–2 weeks`, `More than a month` |
| `duration` | `bn`     | কত দিন ধরে এই সমস্যা হচ্ছে?                                                    | `আজ থেকে`, `কয়েক দিন`, `১–২ সপ্তাহ`, `এক মাসের বেশি`         |
| `severity` | `en`     | How bad is it: mild, moderate or severe?                                       | `Mild`, `Moderate`, `Severe`                                  |
| `severity` | `bn`     | সমস্যাটা কতটা তীব্র: হালকা, মাঝারি, না খুব বেশি?                               | `হালকা`, `মাঝারি`, `খুব বেশি`                                 |

---

## 11. Generated Operational Data (Per-Day Seeded)

`generateSampleData()` generates the following dynamic tables relative to `today` (Dhaka time):

| Collection          | Generation Rules                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Appointments**    | Spans `-90` days through `+13` days (`openDays = 14`). Fill rate: per-doctor popularity `45%–80%` for past days; `75%` today; `60%` for `+1..+2` days; `40%` for `+3..+6` days; `18%` for `+7..+13` days. Past statuses: 80% `seen`, 12% `no_show`, 8% `cancelled`. Future statuses: 93% `booked`, 7% `cancelled`. Today's in-progress sessions mark 1 patient `in_consultation` and 1–3 subsequent patients `arrived`. Sources: `online`, `phone`, `walk_in`. |
| **Triage Sessions** | ~45% of `online` appointments get a linked completed triage session (with pre-visit summary) + 260 standalone unbooked sessions over the past 90 days (4% emergency, 96% from `SAMPLE_PROBLEMS`).                                                                                                                                                                                                                                                              |
| **Queue State**     | Created for each doctor with a session that has already started today, pointing `nowServingId` to their `in_consultation` appointment (or `null`).                                                                                                                                                                                                                                                                                                             |
| **SMS Log**         | Up to 40 most recent `confirmation` SMS messages for non-cancelled bookings created in the last 24 hours.                                                                                                                                                                                                                                                                                                                                                      |

### SMS Templates (`sms.ts`)

- **Confirmation:** `Lumina Specialized Hospital: Booked with {doctorName} on {shortDate}, {start}, serial {serial}. {room}.`
- **Reschedule:** `Lumina Specialized Hospital: Moved to {shortDate}, {start} with {doctorName}, serial {serial}. {room}.`
- **Cancellation (leave):** `Lumina Specialized Hospital: {doctorName} is on leave on {shortDate}. Your {start} appointment is cancelled. Please book again.`
- **Cancellation (other):** `Lumina Specialized Hospital: Your appointment with {doctorName} on {shortDate}, {start} is cancelled.`
- **Reminder:** `Lumina Specialized Hospital: Reminder: {doctorName}, {shortDate}, {start}, serial {serial}. {room}.`
- **OTP (stored masked):** `Lumina Specialized Hospital: Your code is ******. It expires in 5 minutes. Do not share it.`
