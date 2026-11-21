-- Lumina Specialized Hospital — Initial PostgreSQL 16+ schema
-- Implements docs/design/data-model.md including partial unique slot locking.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS specialty (
  id text PRIMARY KEY,
  name_en text NOT NULL,
  name_bn text NOT NULL,
  description_en text NOT NULL DEFAULT '',
  description_bn text NOT NULL DEFAULT '',
  sort_order smallint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS doctor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_bn text NOT NULL,
  specialty_id text NOT NULL REFERENCES specialty(id),
  designation_en text NOT NULL DEFAULT '',
  designation_bn text NOT NULL DEFAULT '',
  qualifications text NOT NULL DEFAULT '',
  experience_years smallint NOT NULL DEFAULT 0,
  fee integer NOT NULL DEFAULT 0,
  gender text NOT NULL DEFAULT 'male',
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS schedule_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES doctor(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  slot_minutes smallint NOT NULL,
  max_patients smallint NOT NULL,
  room text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS leave_day (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES doctor(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  UNIQUE (doctor_id, date)
);

CREATE TABLE IF NOT EXISTS patient (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  age smallint NOT NULL,
  sex text NOT NULL,
  registered_by text NOT NULL DEFAULT 'self',
  phone_verified_at timestamptz
);

CREATE TABLE IF NOT EXISTS triage_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patient(id),
  lang text NOT NULL DEFAULT 'en',
  problem text NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  pending_question text,
  pending_quick_replies jsonb,
  pending_kind text,
  specialty_id text REFERENCES specialty(id),
  urgency text,
  explanation text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  emergency_matches text[],
  summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patient(id),
  doctor_id uuid NOT NULL REFERENCES doctor(id),
  date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  serial smallint NOT NULL,
  status text NOT NULL,
  source text NOT NULL DEFAULT 'online',
  hold_expires_at timestamptz,
  triage_id uuid REFERENCES triage_session(id),
  rescheduled_from_id uuid REFERENCES appointment(id),
  cancel_reason text,
  called_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queue_state (
  doctor_id uuid NOT NULL REFERENCES doctor(id),
  date date NOT NULL,
  now_serving_id uuid REFERENCES appointment(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doctor_id, date)
);

CREATE TABLE IF NOT EXISTS staff_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL,
  doctor_id uuid REFERENCES doctor(id),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS sms_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  kind text NOT NULL,
  body text NOT NULL,
  appointment_id uuid REFERENCES appointment(id),
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_code (
  phone text PRIMARY KEY,
  code_hash text NOT NULL,
  expiry timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS setting (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS user_session (
  id text PRIMARY KEY,
  kind text NOT NULL,
  subject_id uuid,
  phone text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Slot locking: two patients can never hold or book the same doctor/date/start_time.
CREATE UNIQUE INDEX IF NOT EXISTS appointment_one_per_slot
  ON appointment (doctor_id, date, start_time)
  WHERE status <> 'cancelled';

-- Operational indexes from docs/design/data-model.md.
CREATE INDEX IF NOT EXISTS idx_appointment_doctor_date_serial
  ON appointment (doctor_id, date, serial);

CREATE INDEX IF NOT EXISTS idx_appointment_patient_date
  ON appointment (patient_id, date);

CREATE INDEX IF NOT EXISTS idx_appointment_date_status
  ON appointment (date, status);

CREATE INDEX IF NOT EXISTS idx_triage_session_created_at
  ON triage_session (created_at);

CREATE INDEX IF NOT EXISTS idx_sms_message_sent_at
  ON sms_message (sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_rule_doctor
  ON schedule_rule (doctor_id, weekday, start_time);
