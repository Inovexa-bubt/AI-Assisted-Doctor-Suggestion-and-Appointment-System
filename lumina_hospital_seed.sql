--
-- PostgreSQL database dump
--

\restrict bckeI0wDJ0fvEcEcSns7fmdkOfCoBmLqhoR9DL4xbrKkVSi72foKZdf1jA2PUTx

-- Dumped from database version 18.7
-- Dumped by pg_dump version 18.7

-- Started on 2026-11-21 20:49:59

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 226 (class 1259 OID 16506)
-- Name: appointment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    serial smallint,
    status text NOT NULL,
    source text,
    hold_expires_at timestamp with time zone,
    triage_id uuid,
    rescheduled_from_id uuid,
    cancel_reason text,
    called_at timestamp with time zone
);


ALTER TABLE public.appointment OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16400)
-- Name: doctor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name_en text NOT NULL,
    name_bn text,
    specialty_id text,
    designation_en text,
    designation_bn text,
    qualifications text,
    experience_years smallint,
    fee integer,
    gender text,
    active boolean DEFAULT true
);


ALTER TABLE public.doctor OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16435)
-- Name: leave_day; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_day (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    date date NOT NULL,
    reason text
);


ALTER TABLE public.leave_day OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 16575)
-- Name: otp_code; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otp_code (
    phone text NOT NULL,
    code_hash text NOT NULL,
    expiry timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0
);


ALTER TABLE public.otp_code OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16453)
-- Name: patient; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patient (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    age smallint,
    sex text,
    registered_by text,
    phone_verified_at timestamp with time zone
);


ALTER TABLE public.patient OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 16542)
-- Name: queue_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.queue_state (
    doctor_id uuid NOT NULL,
    date date NOT NULL,
    now_serving_id uuid,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.queue_state OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16416)
-- Name: schedule_rule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedule_rule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doctor_id uuid NOT NULL,
    weekday smallint NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    slot_minutes smallint NOT NULL,
    max_patients smallint,
    room text
);


ALTER TABLE public.schedule_rule OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 16586)
-- Name: setting; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.setting (
    key text NOT NULL,
    value jsonb
);


ALTER TABLE public.setting OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16560)
-- Name: sms_message; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_message (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone text NOT NULL,
    kind text,
    body text,
    appointment_id uuid,
    status text,
    sent_at timestamp with time zone
);


ALTER TABLE public.sms_message OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16389)
-- Name: specialty; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.specialty (
    id text NOT NULL,
    name_en text NOT NULL,
    name_bn text,
    description_en text,
    description_bn text,
    sort_order smallint DEFAULT 0,
    active boolean DEFAULT true
);


ALTER TABLE public.specialty OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16485)
-- Name: staff_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_user (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    doctor_id uuid,
    active boolean DEFAULT true
);


ALTER TABLE public.staff_user OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16466)
-- Name: triage_session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.triage_session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    lang text,
    problem text,
    answers jsonb,
    status text,
    specialty_id text,
    urgency text,
    explanation text,
    tags text[],
    summary jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.triage_session OWNER TO postgres;

--
-- TOC entry 5112 (class 0 OID 16506)
-- Dependencies: 226
-- Data for Name: appointment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.appointment (id, patient_id, doctor_id, date, start_time, end_time, serial, status, source, hold_expires_at, triage_id, rescheduled_from_id, cancel_reason, called_at) FROM stdin;
21c84e1b-33ea-335b-40e5-724c1c2e0a86	6c1ac21a-2cf6-cd0b-f241-35136965443f	f0e1afe2-a689-4576-64d4-e230206f7535	2026-11-21	17:30:00	17:42:00	1	seen	online	\N	02fd0613-d32d-3c29-b574-5ed3a0c06faa	\N	\N	\N
7644f087-1c4e-1896-e4f6-8fcde82ea61f	53478790-910a-d1b1-dcd0-fdb3db42bd46	f0e1afe2-a689-4576-64d4-e230206f7535	2026-11-21	17:42:00	17:54:00	2	in_consultation	online	\N	\N	\N	\N	\N
7911ef73-f4c8-5db0-b1a2-77ca68e47178	e8ccd103-6a3e-ee80-165e-7394fcce9fef	f0e1afe2-a689-4576-64d4-e230206f7535	2026-11-21	17:54:00	18:06:00	3	arrived	walk_in	\N	\N	\N	\N	\N
c77984fd-1c23-fe8d-fe13-958d9b5943a0	c9e9a3fb-783b-3fd9-79ca-b87ff6239aef	f0e1afe2-a689-4576-64d4-e230206f7535	2026-11-21	18:06:00	18:18:00	4	booked	phone	\N	\N	\N	\N	\N
c8fa224d-5e1f-092a-196e-fab3e93e38d1	53478790-910a-d1b1-dcd0-fdb3db42bd46	c2e6ca8c-1849-b126-862c-ffeac3389f81	2026-11-23	18:00:00	18:15:00	1	booked	online	\N	bac9e1da-09f9-0f01-a3e1-9e1fbd9f3ff9	\N	\N	\N
754c6c88-409d-7592-e0c6-99b88e777473	eefeeca2-c074-0193-082f-586d861c3577	3243093c-d76e-5e4a-91ab-3f719f0f5f62	2026-11-16	17:00:00	17:12:00	1	seen	online	\N	\N	\N	\N	\N
\.


--
-- TOC entry 5106 (class 0 OID 16400)
-- Dependencies: 220
-- Data for Name: doctor; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctor (id, name_en, name_bn, specialty_id, designation_en, designation_bn, qualifications, experience_years, fee, gender, active) FROM stdin;
3243093c-d76e-5e4a-91ab-3f719f0f5f62	Dr. Mahmudul Hasan	ডা. মাহমুদুল হাসান	medicine	Senior Consultant	সিনিয়র কনসালট্যান্ট	MBBS, FCPS (Medicine)	18	1000	male	t
61951e7f-61d2-9b97-dbe4-39a7e113a7ce	Dr. Sharmin Akter	ডা. শারমিন আক্তার	medicine	Consultant	কনসালট্যান্ট	MBBS, FCPS (Medicine)	9	800	female	t
61251c7b-6b04-88e3-03a4-4069fac25ba2	Dr. Arifur Rahman	ডা. আরিফুর রহমান	medicine	Consultant	কনসালট্যান্ট	MBBS, MD (Internal Medicine)	10	900	male	t
c2e6ca8c-1849-b126-862c-ffeac3389f81	Dr. Rezaul Karim	ডা. রেজাউল করিম	cardiology	Senior Consultant	সিনিয়র কনসালট্যান্ট	MBBS, MD (Cardiology)	22	1500	male	t
651e3b38-29ae-696d-9ccd-1549415906c1	Dr. Nadia Islam	ডা. নাদিয়া ইসলাম	cardiology	Consultant	কনসালট্যান্ট	MBBS, MD (Cardiology)	11	1200	female	t
3ae4fd5a-380b-1761-6f0b-e818487d4ce3	Dr. Anisur Rahman	ডা. আনিসুর রহমান	neurology	Consultant	কনসালট্যান্ট	MBBS, MD (Neurology)	14	1200	male	t
00b67151-b942-1845-44d1-905beb4586bd	Dr. Lubna Yasmin	ডা. লুবনা ইয়াসমিন	neurology	Associate Consultant	অ্যাসোসিয়েট কনসালট্যান্ট	MBBS, MD (Neurology)	7	1000	female	t
f0e1afe2-a689-4576-64d4-e230206f7535	Dr. Tanvir Hasan	ডা. তানভীর হাসান	gastroenterology	Consultant	কনসালট্যান্ট	MBBS, MD (Gastroenterology)	12	1000	male	t
de34546d-b5df-1ad4-efdf-7902801b9470	Dr. Farzana Chowdhury	ডা. ফারজানা চৌধুরী	gastroenterology	Associate Consultant	অ্যাসোসিয়েট কনসালট্যান্ট	MBBS, FCPS (Medicine), MD (Gastroenterology)	8	900	female	t
431d40d8-0987-7aae-07cd-3bc70f5c4e0d	Dr. Kamrul Islam	ডা. কামরুল ইসলাম	orthopedics	Senior Consultant	সিনিয়র কনসালট্যান্ট	MBBS, MS (Orthopaedics)	20	1200	male	t
2d29a7f3-6732-88f6-aa3e-116d7ed87a9c	Dr. Sabrina Haque	ডা. সাবরিনা হক	orthopedics	Consultant	কনসালট্যান্ট	MBBS, MS (Orthopaedics)	7	1000	female	t
3f6a0619-da20-b644-7d91-bb0f89f0a6a0	Dr. Rokeya Begum	ডা. রোকেয়া বেগম	gynecology	Senior Consultant	সিনিয়র কনসালট্যান্ট	MBBS, FCPS (Gynae & Obs)	21	1200	female	t
2ecbc9c5-e974-ad68-1761-d18cbfabcdf4	Dr. Tahmina Ahmed	ডা. তাহমিনা আহমেদ	gynecology	Consultant	কনসালট্যান্ট	MBBS, FCPS (Gynae & Obs)	10	1000	female	t
85ed390a-88ff-a86e-e786-d6f6387f07fc	Dr. Shafiqul Alam	ডা. শফিকুল আলম	pediatrics	Senior Consultant	সিনিয়র কনসালট্যান্ট	MBBS, FCPS (Paediatrics)	16	1000	male	t
f2aab5d3-ebf2-6368-550f-6a368d096280	Dr. Ishrat Jahan	ডা. ইশরাত জাহান	pediatrics	Consultant	কনসালট্যান্ট	MBBS, DCH, FCPS (Paediatrics)	9	900	female	t
c0de9d1d-1cae-e027-9b7b-3a77ca7d832f	Dr. Abdul Mannan	ডা. আবদুল মান্নান	ent	Consultant	কনসালট্যান্ট	MBBS, DLO, FCPS (ENT)	15	1000	male	t
63b0ec29-c4ea-8745-3995-fc565731f829	Dr. Sumaiya Rahman	ডা. সুমাইয়া রহমান	dermatology	Consultant	কনসালট্যান্ট	MBBS, DDV, FCPS (Dermatology)	8	1000	female	t
2064393f-0ed3-ed94-8945-3ea1bcb25306	Dr. Mizanur Rahman	ডা. মিজানুর রহমান	respiratory	Senior Consultant	সিনিয়র কনসালট্যান্ট	MBBS, FCPS (Medicine), MD (Chest)	19	1200	male	t
2fb41fee-924e-9831-4761-ed056289bf65	Dr. Shahana Parvin	ডা. শাহানা পারভীন	endocrinology	Consultant	কনসালট্যান্ট	MBBS, MD (Endocrinology)	13	1200	female	t
ac46d466-623c-d15d-2ec8-b500ed1d9918	Dr. Jahangir Alam	ডা. জাহাঙ্গীর আলম	ophthalmology	Consultant	কনসালট্যান্ট	MBBS, FCPS (Ophthalmology)	17	900	male	t
21f2cc13-263f-6356-2b65-1a45d2dd1ab9	Dr. Rafiqul Islam	ডা. রফিকুল ইসলাম	psychiatry	Consultant	কনসালট্যান্ট	MBBS, FCPS (Psychiatry)	12	1200	male	t
b0e57f07-bbda-a0f7-7044-5d7ab4bcfb93	Dr. Moinul Hossain	ডা. মঈনুল হোসেন	urology	Consultant	কনসালট্যান্ট	MBBS, MS (Urology)	14	1200	male	t
\.


--
-- TOC entry 5108 (class 0 OID 16435)
-- Dependencies: 222
-- Data for Name: leave_day; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave_day (id, doctor_id, date, reason) FROM stdin;
23a387e7-d869-daa0-cb0a-9071082549d1	c2e6ca8c-1849-b126-862c-ffeac3389f81	2026-10-12	Conference
00ac7ab9-f590-e983-dcdb-947d819d7907	431d40d8-0987-7aae-07cd-3bc70f5c4e0d	2026-11-01	Personal
c88bdd3b-944e-d639-ee12-f425c23407b6	3ae4fd5a-380b-1761-6f0b-e818487d4ce3	2026-11-26	Conference abroad
f02ab244-bbeb-912e-f47c-6097c1b61c6e	63b0ec29-c4ea-8745-3995-fc565731f829	2026-11-30	Personal
\.


--
-- TOC entry 5115 (class 0 OID 16575)
-- Dependencies: 229
-- Data for Name: otp_code; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.otp_code (phone, code_hash, expiry, attempts) FROM stdin;
\.


--
-- TOC entry 5109 (class 0 OID 16453)
-- Dependencies: 223
-- Data for Name: patient; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.patient (id, name, phone, age, sex, registered_by, phone_verified_at) FROM stdin;
6c1ac21a-2cf6-cd0b-f241-35136965443f	Karim Hossain	01410007919	21	male	self	2026-11-21 19:41:17.889307+06
53478790-910a-d1b1-dcd0-fdb3db42bd46	Nasima Khatun	01510015838	22	female	self	2026-11-21 18:41:17.889307+06
e8ccd103-6a3e-ee80-165e-7394fcce9fef	Tariq Islam	01610023757	23	male	self	2026-11-21 17:41:17.889307+06
c9e9a3fb-783b-3fd9-79ca-b87ff6239aef	Sumaiya Hossain	01710031676	24	female	self	2026-11-21 16:41:17.889307+06
eefeeca2-c074-0193-082f-586d861c3577	Sakib Chowdhury	01810039595	25	male	front_desk	2026-11-21 15:41:17.889307+06
445f4fa4-426d-59e6-fdd3-0ba4bcc39771	Rumana Islam	01910047514	8	female	self	2026-11-21 14:41:17.889307+06
db89f151-6af5-1fa1-cbfc-0255d250e297	Jamal Sarker	01310055433	27	male	self	2026-11-21 13:41:17.889307+06
126528a5-8365-81f6-3763-ffb48b60a2c0	Sadia Chowdhury	01410063352	28	female	self	2026-11-21 12:41:17.889307+06
f3e1ec56-64cb-c762-cf89-d98e76a8621f	Nayeem Ahmed	01510071271	29	male	self	2026-11-21 11:41:17.889307+06
36f68adc-a74d-6f9c-ef85-8d2501bf7277	Mim Begum	01610079190	30	female	front_desk	2026-11-21 10:41:17.889307+06
b4f4f3a4-2e1d-3777-0547-f363a74663a5	Shafiq Rahman	01710087109	31	male	self	2026-11-21 09:41:17.889307+06
ab4ad855-ca2d-3ae3-6708-279091893df3	রহিম উদ্দিন	01810095028	2	female	self	2026-11-21 08:41:17.889307+06
72971f7a-106f-4f25-4855-72c6d4268b47	Karim Khan	01910102947	33	male	self	2026-11-21 07:41:17.889307+06
7e2627ca-7619-e7b7-cdfd-5da1438f72e0	Nasima Rahman	01310110866	34	female	self	2026-11-21 06:41:17.889307+06
a39970ae-d658-88d6-e75e-1c4dd99a8650	Tariq Uddin	01410118785	35	male	front_desk	2026-11-21 05:41:17.889307+06
73a9c539-4566-ff6c-16fc-cb2c0a8e26ed	Sumaiya Khan	01510126704	36	female	self	2026-11-21 04:41:17.889307+06
02e1aca7-bfab-6ab8-f189-00e2300567da	Sakib Roy	01610134623	37	male	self	2026-11-21 03:41:17.889307+06
b26d22e8-ca17-cb57-1224-2baa44d6b2dd	Rumana Akter	01710142542	8	female	self	2026-11-21 02:41:17.889307+06
70f639ea-35b1-517a-ef74-0fe8bc897326	Jamal Hossain	01810150461	39	male	self	2026-11-21 01:41:17.889307+06
8bcbc33f-c64d-661f-9bba-4ce4820b91c0	Sadia Khatun	01910158380	40	female	front_desk	2026-11-21 00:41:17.889307+06
eb300bd4-e3a6-cf88-a13c-7f59c7a63fae	Nayeem Islam	01310166299	41	male	self	2026-11-20 23:41:17.889307+06
be4986fd-1a44-09f5-2276-c97aace2d7e4	Mim Hossain	01410174218	42	female	self	2026-11-20 22:41:17.889307+06
fe2c27e9-9a19-f788-e9dd-31999865a78a	Shafiq Chowdhury	01510182137	43	male	self	2026-11-20 21:41:17.889307+06
0de27161-5967-8527-f248-1d1d13283a4c	রহিম উদ্দিন	01610190056	2	female	self	2026-11-20 20:41:17.889307+06
74c60f02-0661-a09e-9bc3-270957cc9b3b	Karim Sarker	01710197975	45	male	front_desk	2026-11-20 19:41:17.889307+06
79f4e124-e65e-e703-d895-4d7fd3763340	Nasima Chowdhury	01810205894	46	female	self	2026-11-20 18:41:17.889307+06
5ff4b567-bbd3-ec37-d26e-a372c0aa7b5c	Tariq Ahmed	01910213813	47	male	self	2026-11-20 17:41:17.889307+06
a8a03967-4d2a-8286-e3bf-9caa48dd9af7	Sumaiya Begum	01310221732	48	female	self	2026-11-20 16:41:17.889307+06
2eeda9c0-8c10-4729-d6e3-d172c6dc5c28	Sakib Rahman	01410229651	49	male	self	2026-11-20 15:41:17.889307+06
072737be-8147-a106-52c3-7e4fa983afce	Rumana Ahmed	01510237570	8	female	front_desk	2026-11-20 14:41:17.889307+06
662ff199-9b53-60c1-de4a-55194e27bbdd	Jamal Khan	01610245489	51	male	self	2026-11-20 13:41:17.889307+06
979b007e-0279-df99-bfbf-2373642eb4c3	Sadia Rahman	01710253408	52	female	self	2026-11-20 12:41:17.889307+06
05a29375-2534-b4d4-2965-8db94594c1c5	Nayeem Uddin	01810261327	53	male	self	2026-11-20 11:41:17.889307+06
c2bc75ef-18f8-c387-696e-5a7f598cf5d7	Mim Khan	01910269246	54	female	self	2026-11-20 10:41:17.889307+06
88e940ca-54b7-c0d2-325d-ce177ab6e98d	Shafiq Roy	01310277165	55	male	front_desk	2026-11-20 09:41:17.889307+06
f7c04a11-441c-e352-e06d-a6db85e7d9c1	রহিম উদ্দিন	01410285084	2	female	self	2026-11-20 08:41:17.889307+06
1ecc6ca5-6504-1adb-ee70-31c3226f60e9	Karim Hossain	01510293003	57	male	self	2026-11-20 07:41:17.889307+06
7df3df3b-f7cb-3918-a8ee-f47b45e54801	Nasima Khatun	01610300922	58	female	self	2026-11-20 06:41:17.889307+06
3315288a-7b05-5f5f-6040-942201e21038	Tariq Islam	01710308841	59	male	self	2026-11-20 05:41:17.889307+06
8cea8410-33cb-124a-d911-1cc184b1e3dc	Sumaiya Hossain	01810316760	60	female	front_desk	2026-11-20 04:41:17.889307+06
ae7dcf58-129c-2b07-ae13-1f51b330201a	Sakib Chowdhury	01910324679	61	male	self	2026-11-20 03:41:17.889307+06
c91ef6b4-3b39-f224-d8f4-f54cc477c461	Rumana Islam	01310332598	8	female	self	2026-11-20 02:41:17.889307+06
c9c05ca9-696d-d0aa-e2ba-9758807a4e2b	Jamal Sarker	01410340517	63	male	self	2026-11-20 01:41:17.889307+06
8f308836-62a9-affa-9e24-fdaa7b28f666	Sadia Chowdhury	01510348436	64	female	self	2026-11-20 00:41:17.889307+06
711e33f0-ffbc-a346-b103-65e057c4dccf	Nayeem Ahmed	01610356355	65	male	front_desk	2026-11-19 23:41:17.889307+06
b876474d-5655-7e01-e518-447576279527	Mim Begum	01710364274	66	female	self	2026-11-19 22:41:17.889307+06
a69b39e8-5f6b-a83c-cd19-ae8715ee7a4d	Shafiq Rahman	01810372193	67	male	self	2026-11-19 21:41:17.889307+06
46f72c92-058a-ca63-e8b4-fbf1d8708736	রহিম উদ্দিন	01910380112	2	female	self	2026-11-19 20:41:17.889307+06
b70471ed-a511-c202-465c-3fcddca27ebd	Karim Khan	01310388031	69	male	self	2026-11-19 19:41:17.889307+06
4267be6b-9112-4ac3-ce93-791e25eb74e9	Nasima Rahman	01410395950	70	female	front_desk	2026-11-19 18:41:17.889307+06
20d8b2b9-4814-8cad-b0d9-b38c70f98ce4	Tariq Uddin	01510403869	71	male	self	2026-11-19 17:41:17.889307+06
737b3fe7-196f-d321-fd0c-15c5b19a83bc	Sumaiya Khan	01610411788	72	female	self	2026-11-19 16:41:17.889307+06
593fd0c1-97b4-32c1-8b6e-c4208120a0d6	Sakib Roy	01710419707	73	male	self	2026-11-19 15:41:17.889307+06
d24404c3-7cb0-b55d-d5d3-db3730c3dc78	Rumana Akter	01810427626	8	female	self	2026-11-19 14:41:17.889307+06
516e792b-bbe2-afa8-f6f6-e52de3f29fe5	Jamal Hossain	01910435545	20	male	front_desk	2026-11-19 13:41:17.889307+06
faf597e4-868f-e35a-f99f-cbb581928a8d	Sadia Khatun	01310443464	21	female	self	2026-11-19 12:41:17.889307+06
63221534-5a53-f33b-db18-a5aa198263b5	Nayeem Islam	01410451383	22	male	self	2026-11-19 11:41:17.889307+06
f19c3071-57c4-77a1-a053-f165e1e5e8b5	Mim Hossain	01510459302	23	female	self	2026-11-19 10:41:17.889307+06
60b44f67-e6db-f259-169b-7753f1b851af	Shafiq Chowdhury	01610467221	24	male	self	2026-11-19 09:41:17.889307+06
91d884d7-bc88-23e8-667f-074f8c6a0df8	রহিম উদ্দিন	01710475140	2	female	front_desk	2026-11-19 08:41:17.889307+06
57f6091e-75f9-8ce9-54bb-4bf49201016c	Karim Sarker	01810483059	26	male	self	2026-11-19 07:41:17.889307+06
b3b5c646-5733-ef01-8602-94fb2531d429	Nasima Chowdhury	01910490978	27	female	self	2026-11-19 06:41:17.889307+06
d42d9843-5345-a6ac-b4a1-456e96b39a9c	Tariq Ahmed	01310498897	28	male	self	2026-11-19 05:41:17.889307+06
9f2afc8c-815f-64e9-5339-39282dd2c556	Sumaiya Begum	01410506816	29	female	self	2026-11-19 04:41:17.889307+06
a45948a2-8c37-4ebe-e93a-f5c82920a8ac	Sakib Rahman	01510514735	30	male	front_desk	2026-11-19 03:41:17.889307+06
6b982b6a-d6ed-04d2-464a-b8726df9ced6	Rumana Ahmed	01610522654	8	female	self	2026-11-19 02:41:17.889307+06
8b87a8bf-ac8f-47a7-35ad-3ab9e1c23f06	Jamal Khan	01710530573	32	male	self	2026-11-19 01:41:17.889307+06
6bf00fb1-9b5b-d688-95cf-7093b5cb084d	Sadia Rahman	01810538492	33	female	self	2026-11-19 00:41:17.889307+06
5fa0d016-a423-ab03-fe14-3fca6163452f	Nayeem Uddin	01910546411	34	male	self	2026-11-18 23:41:17.889307+06
b1cbf2b0-03b0-6939-9baa-96da51058ab7	Mim Khan	01310554330	35	female	front_desk	2026-11-18 22:41:17.889307+06
840af134-c506-b67a-7666-2825b1e13960	Shafiq Roy	01410562249	36	male	self	2026-11-18 21:41:17.889307+06
9c42973b-91fa-27dc-26ec-fd65d744307a	রহিম উদ্দিন	01510570168	2	female	self	2026-11-18 20:41:17.889307+06
6ae5e97b-32e9-16f8-00fa-616ed549ecae	Karim Hossain	01610578087	38	male	self	2026-11-18 19:41:17.889307+06
9ef775bd-a379-52e8-6d5e-8549bbfa67bf	Nasima Khatun	01710586006	39	female	self	2026-11-18 18:41:17.889307+06
48c55756-ef1c-a456-9908-0911445373e7	Tariq Islam	01810593925	40	male	front_desk	2026-11-18 17:41:17.889307+06
92eb0d04-1ff9-c848-f847-e9d01faf5286	Sumaiya Hossain	01910601844	41	female	self	2026-11-18 16:41:17.889307+06
e602aebe-02ec-33c0-696d-46db4b6666b8	Sakib Chowdhury	01310609763	42	male	self	2026-11-18 15:41:17.889307+06
be325723-e040-af43-3a50-92d52194272b	Rumana Islam	01410617682	8	female	self	2026-11-18 14:41:17.889307+06
6f135d20-ef61-16c5-cdaf-36a276cee904	Jamal Sarker	01510625601	44	male	self	2026-11-18 13:41:17.889307+06
61a74455-aaef-1552-2ca7-c66d94aeb24e	Sadia Chowdhury	01610633520	45	female	front_desk	2026-11-18 12:41:17.889307+06
af5a7c68-ee8c-fa32-22db-81ff7eabad4d	Nayeem Ahmed	01710641439	46	male	self	2026-11-18 11:41:17.889307+06
12ba7956-a643-ebe6-6c9f-c3bb4b78a072	Mim Begum	01810649358	47	female	self	2026-11-18 10:41:17.889307+06
2bbd03a5-ea37-8db3-194b-94b99ab2c87e	Shafiq Rahman	01910657277	48	male	self	2026-11-18 09:41:17.889307+06
0c76d9c9-6a5e-da8f-1ae4-54d7bc24fdc0	রহিম উদ্দিন	01310665196	2	female	self	2026-11-18 08:41:17.889307+06
c461b1e1-5918-6026-2a59-489740a46161	Karim Khan	01410673115	50	male	front_desk	2026-11-18 07:41:17.889307+06
9ef9fe95-98ff-8dda-1d81-825a74fb3069	Nasima Rahman	01510681034	51	female	self	2026-11-18 06:41:17.889307+06
b2feb6b4-4154-1825-fd2e-a89e27667210	Tariq Uddin	01610688953	52	male	self	2026-11-18 05:41:17.889307+06
20c9c49b-5b3a-35a7-3afa-b99451bd83b6	Sumaiya Khan	01710696872	53	female	self	2026-11-18 04:41:17.889307+06
17372370-8b36-fa03-6bea-6e8a6b81b0c9	Sakib Roy	01810704791	54	male	self	2026-11-18 03:41:17.889307+06
97deb575-552a-1152-03f9-f10eb2177ef5	Rumana Akter	01910712710	8	female	front_desk	2026-11-18 02:41:17.889307+06
22a67b32-61c2-5a3d-746f-7e561f917ebd	Jamal Hossain	01310720629	56	male	self	2026-11-18 01:41:17.889307+06
6a465d74-fa3d-fbef-1df4-5c116fd493dd	Sadia Khatun	01410728548	57	female	self	2026-11-18 00:41:17.889307+06
806a83e3-07e9-8ac3-69d8-c3fb6d6addcd	Nayeem Islam	01510736467	58	male	self	2026-11-17 23:41:17.889307+06
f61899da-baa6-5ca9-6b0f-2aa759aad54c	Mim Hossain	01610744386	59	female	self	2026-11-17 22:41:17.889307+06
be90c39a-dc00-e42e-c55d-f8e811378bbe	Shafiq Chowdhury	01710752305	60	male	front_desk	2026-11-17 21:41:17.889307+06
cfb48c38-3376-13a5-b37e-8e5f7608318c	রহিম উদ্দিন	01810760224	2	female	self	2026-11-17 20:41:17.889307+06
6d3732a8-e84e-ffc2-e4fd-b9ac0a477e21	Karim Sarker	01910768143	62	male	self	2026-11-17 19:41:17.889307+06
0503993f-7368-31a1-8a67-cc53183b82a5	Nasima Chowdhury	01310776062	63	female	self	2026-11-17 18:41:17.889307+06
87bc4c7f-6129-0fe4-e5a7-7fe828dc760b	Tariq Ahmed	01410783981	64	male	self	2026-11-17 17:41:17.889307+06
11b63d1e-54ef-dc18-bcd2-db7c6d975982	Sumaiya Begum	01510791900	65	female	front_desk	2026-11-17 16:41:17.889307+06
\.


--
-- TOC entry 5113 (class 0 OID 16542)
-- Dependencies: 227
-- Data for Name: queue_state; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.queue_state (doctor_id, date, now_serving_id, updated_at) FROM stdin;
f0e1afe2-a689-4576-64d4-e230206f7535	2026-11-21	7644f087-1c4e-1896-e4f6-8fcde82ea61f	2026-11-21 20:43:25.742337+06
\.


--
-- TOC entry 5107 (class 0 OID 16416)
-- Dependencies: 221
-- Data for Name: schedule_rule; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schedule_rule (id, doctor_id, weekday, start_time, end_time, slot_minutes, max_patients, room) FROM stdin;
9dda79bb-d35d-5d40-a1fe-56c810606128	3243093c-d76e-5e4a-91ab-3f719f0f5f62	0	17:00:00	21:00:00	12	20	Room 101
ec1973d7-195e-7011-e1fb-6f89ced6864f	3243093c-d76e-5e4a-91ab-3f719f0f5f62	2	17:00:00	21:00:00	12	20	Room 101
9cf85eff-1edf-3753-c286-84409d02abfc	3243093c-d76e-5e4a-91ab-3f719f0f5f62	4	17:00:00	21:00:00	12	20	Room 101
b2857daf-1f21-ce37-f5df-d9dccb7e7836	61951e7f-61d2-9b97-dbe4-39a7e113a7ce	6	10:00:00	13:00:00	10	18	Room 102
e5360be4-3a4d-49a0-4c2b-10941c38f48c	61951e7f-61d2-9b97-dbe4-39a7e113a7ce	1	10:00:00	13:00:00	10	18	Room 102
039cc84a-24b9-5006-18a0-81f4a1ace6fc	61951e7f-61d2-9b97-dbe4-39a7e113a7ce	3	10:00:00	13:00:00	10	18	Room 102
739ca523-57d9-5a11-d97a-5d88501b25dd	61251c7b-6b04-88e3-03a4-4069fac25ba2	6	17:00:00	21:00:00	12	20	Room 103
700a21d3-b3a7-0981-4cef-be862035d7ba	61251c7b-6b04-88e3-03a4-4069fac25ba2	1	17:00:00	21:00:00	12	20	Room 103
5e7a1fa8-937d-bd94-3f97-880208e5e7c9	61251c7b-6b04-88e3-03a4-4069fac25ba2	3	17:00:00	21:00:00	12	20	Room 103
cef76d80-a65b-9a70-1df9-f1d95d24b263	c2e6ca8c-1849-b126-862c-ffeac3389f81	6	18:00:00	21:00:00	15	12	Room 201
ff97e2d7-7c10-0843-aa1e-8d58b2d036a5	c2e6ca8c-1849-b126-862c-ffeac3389f81	1	18:00:00	21:00:00	15	12	Room 201
ad5bb25e-7fce-6cce-0706-e959571f65d8	c2e6ca8c-1849-b126-862c-ffeac3389f81	3	18:00:00	21:00:00	15	12	Room 201
529e1258-16df-c66a-fd36-fc8058ead9a9	651e3b38-29ae-696d-9ccd-1549415906c1	0	10:00:00	13:00:00	15	12	Room 202
ce9c8c0d-83e9-5056-38e4-e382949eb2ef	651e3b38-29ae-696d-9ccd-1549415906c1	2	10:00:00	13:00:00	15	12	Room 202
9b21c55b-3fe9-df60-f692-5ef5741f3eb2	3ae4fd5a-380b-1761-6f0b-e818487d4ce3	0	17:00:00	20:00:00	15	12	Room 203
f36551a4-02db-d486-5f01-017065b258a4	3ae4fd5a-380b-1761-6f0b-e818487d4ce3	3	17:00:00	20:00:00	15	12	Room 203
31645eab-13b1-adaf-343e-aacb8b5f044d	00b67151-b942-1845-44d1-905beb4586bd	6	10:00:00	13:00:00	15	12	Room 204
6dfe27ea-4039-4185-de7f-5da576894eb4	00b67151-b942-1845-44d1-905beb4586bd	1	10:00:00	13:00:00	15	12	Room 204
64509d0f-2beb-a526-53a3-53439b4aaa73	f0e1afe2-a689-4576-64d4-e230206f7535	6	17:30:00	20:30:00	12	15	Room 301
5b48e624-e867-3327-a62b-6603a9403881	f0e1afe2-a689-4576-64d4-e230206f7535	1	17:30:00	20:30:00	12	15	Room 301
d387d026-1c0b-0634-cd7a-0b77192033ad	f0e1afe2-a689-4576-64d4-e230206f7535	4	17:30:00	20:30:00	12	15	Room 301
a86013c4-36ac-69ac-8188-73174e16f3cb	f0e1afe2-a689-4576-64d4-e230206f7535	4	10:00:00	12:00:00	12	10	Room 301
dc2c6647-c83e-091f-2d9c-cbc22fe65290	de34546d-b5df-1ad4-efdf-7902801b9470	0	10:00:00	12:30:00	10	15	Room 302
625d9d04-c188-7bff-4a77-a52a23c58023	de34546d-b5df-1ad4-efdf-7902801b9470	2	10:00:00	12:30:00	10	15	Room 302
9b666c68-ade4-d6be-89a0-beedc5e62295	431d40d8-0987-7aae-07cd-3bc70f5c4e0d	6	16:00:00	20:00:00	15	16	Room 303
13125c97-06bc-24f3-8d3a-a598a59d73de	431d40d8-0987-7aae-07cd-3bc70f5c4e0d	2	16:00:00	20:00:00	15	16	Room 303
fc5eff46-7e43-661d-a748-85ed0b0cfa6f	431d40d8-0987-7aae-07cd-3bc70f5c4e0d	4	16:00:00	20:00:00	15	16	Room 303
a4a22372-d5a2-ba0d-7394-c64d0e6c4c93	2d29a7f3-6732-88f6-aa3e-116d7ed87a9c	1	10:30:00	13:00:00	15	10	Room 304
b4f8d192-bb56-7762-55ff-3be9f1ceeaec	2d29a7f3-6732-88f6-aa3e-116d7ed87a9c	3	10:30:00	13:00:00	15	10	Room 304
8a2a2086-b2cd-0a1b-7c62-3562c2686707	3f6a0619-da20-b644-7d91-bb0f89f0a6a0	6	16:00:00	20:00:00	12	20	Room 401
54f266f4-27e1-2803-f4b9-64b56488135f	3f6a0619-da20-b644-7d91-bb0f89f0a6a0	1	16:00:00	20:00:00	12	20	Room 401
1dba813b-aab8-572e-d7a9-dafcebf77c10	3f6a0619-da20-b644-7d91-bb0f89f0a6a0	3	16:00:00	20:00:00	12	20	Room 401
c710c2df-a14e-dd08-3fbe-91ea6b3221e1	2ecbc9c5-e974-ad68-1761-d18cbfabcdf4	0	10:00:00	13:00:00	12	15	Room 402
f258477f-1289-388b-a734-045e6b5e76d5	2ecbc9c5-e974-ad68-1761-d18cbfabcdf4	2	10:00:00	13:00:00	12	15	Room 402
b4fa9700-a5f6-9b66-b934-a593325f0028	2ecbc9c5-e974-ad68-1761-d18cbfabcdf4	4	10:00:00	13:00:00	12	15	Room 402
9b233a6f-21d5-6a5a-8a88-a607a4b58fd3	85ed390a-88ff-a86e-e786-d6f6387f07fc	6	17:00:00	20:00:00	10	18	Room 403
8c036e17-be54-3b8d-33dc-c236c46d1514	85ed390a-88ff-a86e-e786-d6f6387f07fc	0	17:00:00	20:00:00	10	18	Room 403
26a1de0d-27c4-1856-74ab-bc4f01d59199	85ed390a-88ff-a86e-e786-d6f6387f07fc	2	17:00:00	20:00:00	10	18	Room 403
924dec19-f2d2-e54d-9910-ab21a01c634f	85ed390a-88ff-a86e-e786-d6f6387f07fc	4	17:00:00	20:00:00	10	18	Room 403
6d3ebebe-664a-2a93-eace-17cc08b84c4b	f2aab5d3-ebf2-6368-550f-6a368d096280	1	10:00:00	13:00:00	10	18	Room 404
799d2b74-0bba-c469-bed1-d3029b495c46	f2aab5d3-ebf2-6368-550f-6a368d096280	3	10:00:00	13:00:00	10	18	Room 404
528f4821-f0a0-8452-69a3-dce8b3ad8485	c0de9d1d-1cae-e027-9b7b-3a77ca7d832f	0	17:00:00	20:00:00	12	15	Room 501
5b8130da-f2df-8d5e-39cf-ce0d0679f1a5	c0de9d1d-1cae-e027-9b7b-3a77ca7d832f	2	17:00:00	20:00:00	12	15	Room 501
cb5d64c4-8391-7209-2dba-aef7b8a30db8	c0de9d1d-1cae-e027-9b7b-3a77ca7d832f	4	17:00:00	20:00:00	12	15	Room 501
36412984-9e77-4521-b023-c44b27472226	63b0ec29-c4ea-8745-3995-fc565731f829	6	17:00:00	20:00:00	10	18	Room 502
dee91d8f-2e34-c70a-96ae-5b102b15cf31	63b0ec29-c4ea-8745-3995-fc565731f829	1	17:00:00	20:00:00	10	18	Room 502
c614b4ae-9a68-c8a5-45e2-94ad784c86df	63b0ec29-c4ea-8745-3995-fc565731f829	3	17:00:00	20:00:00	10	18	Room 502
2c78c98f-554a-a2ee-b4a6-f4ae29620e0d	2064393f-0ed3-ed94-8945-3ea1bcb25306	0	17:00:00	20:00:00	15	12	Room 503
c61e34ee-ec95-ce71-b289-a80ded1d8908	2064393f-0ed3-ed94-8945-3ea1bcb25306	3	17:00:00	20:00:00	15	12	Room 503
3c969efd-bf0b-8b96-544d-e4e571b66311	2fb41fee-924e-9831-4761-ed056289bf65	6	10:00:00	13:00:00	15	12	Room 504
d36de37d-7abc-cb16-65ae-7657069656df	2fb41fee-924e-9831-4761-ed056289bf65	2	10:00:00	13:00:00	15	12	Room 504
5b6edeac-e93a-b71d-951a-174cc69f9509	2fb41fee-924e-9831-4761-ed056289bf65	4	10:00:00	13:00:00	15	12	Room 504
8c430d2f-9592-b98d-dc67-3c3c727a9e02	ac46d466-623c-d15d-2ec8-b500ed1d9918	6	16:00:00	19:00:00	10	18	Room 601
fa8325fa-da30-61cb-87a3-bd4b9a25e1f2	ac46d466-623c-d15d-2ec8-b500ed1d9918	1	16:00:00	19:00:00	10	18	Room 601
9b34c786-ebbb-dd75-4ea6-db958913354e	ac46d466-623c-d15d-2ec8-b500ed1d9918	3	16:00:00	19:00:00	10	18	Room 601
3c3d5683-9ec4-c446-2e61-3c16d20a01bf	21f2cc13-263f-6356-2b65-1a45d2dd1ab9	2	17:00:00	20:00:00	20	9	Room 602
92b083c5-3894-2d12-ef17-30c2ace7cfd2	21f2cc13-263f-6356-2b65-1a45d2dd1ab9	4	17:00:00	20:00:00	20	9	Room 602
20d4fafc-ecf9-104e-c7e3-66c8444e9b70	b0e57f07-bbda-a0f7-7044-5d7ab4bcfb93	0	18:00:00	21:00:00	15	12	Room 603
34204609-fad9-2358-446f-5ac91be5ee79	b0e57f07-bbda-a0f7-7044-5d7ab4bcfb93	3	18:00:00	21:00:00	15	12	Room 603
\.


--
-- TOC entry 5116 (class 0 OID 16586)
-- Dependencies: 230
-- Data for Name: setting; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.setting (key, value) FROM stdin;
reminder	{"time": "19:00", "daysBefore": 1}
booking	{"openDays": 14, "closeMinutesBefore": 60}
\.


--
-- TOC entry 5114 (class 0 OID 16560)
-- Dependencies: 228
-- Data for Name: sms_message; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sms_message (id, phone, kind, body, appointment_id, status, sent_at) FROM stdin;
5106fdf2-7868-5f73-7a07-dbba8e710453	01410007919	confirmation	Lumina Specialized Hospital: Booked with Dr. Tanvir Hasan on today, 17:30, serial 1. Room 301.	21c84e1b-33ea-335b-40e5-724c1c2e0a86	sent	2026-11-21 18:44:03.169623+06
d56c8eac-0974-c801-56b5-5b80583620d7	01510015838	confirmation	Lumina Specialized Hospital: Booked with Dr. Rezaul Karim, 18:00, serial 1. Room 201.	c8fa224d-5e1f-092a-196e-fab3e93e38d1	sent	2026-11-21 20:14:03.169623+06
\.


--
-- TOC entry 5105 (class 0 OID 16389)
-- Dependencies: 219
-- Data for Name: specialty; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.specialty (id, name_en, name_bn, description_en, description_bn, sort_order, active) FROM stdin;
medicine	Medicine	মেডিসিন	Fever, weakness, general health problems and first check-ups.	জ্বর, দুর্বলতা, সাধারণ স্বাস্থ্য সমস্যা ও প্রাথমিক পরীক্ষা।	1	t
cardiology	Cardiology	হৃদরোগ	Heart problems, high blood pressure and palpitations.	হৃদযন্ত্রের সমস্যা, উচ্চ রক্তচাপ ও বুক ধড়ফড়।	2	t
neurology	Neurology	স্নায়ুরোগ	Headache, migraine, dizziness, numbness and nerve problems.	মাথাব্যথা, মাইগ্রেন, মাথা ঘোরা, অবশ ভাব ও স্নায়ুর সমস্যা।	3	t
gastroenterology	Gastroenterology & Liver	পরিপাকতন্ত্র ও লিভার	Stomach pain, acidity, diarrhoea, constipation, jaundice and liver problems.	পেট ব্যথা, গ্যাস্ট্রিক, ডায়রিয়া, কোষ্ঠকাঠিন্য, জন্ডিস ও লিভারের সমস্যা।	4	t
orthopedics	Orthopaedics	অর্থোপেডিক্স	Bone, joint, back and neck pain, fractures and injuries.	হাড়, জোড়া, কোমর ও ঘাড়ের ব্যথা, হাড় ভাঙা ও আঘাত।	5	t
gynecology	Gynaecology & Obstetrics	স্ত্রীরোগ ও প্রসূতি	Periods, pregnancy and women's health.	মাসিক, গর্ভাবস্থা ও নারীস্বাস্থ্য।	6	t
pediatrics	Paediatrics	শিশুরোগ	Health problems of babies and children.	নবজাতক ও শিশুদের স্বাস্থ্য সমস্যা।	7	t
ent	ENT (Ear, Nose & Throat)	নাক, কান ও গলা	Ear pain, hearing loss, sinus, tonsils and throat problems.	কানে ব্যথা, কম শোনা, সাইনাস, টনসিল ও গলার সমস্যা।	8	t
dermatology	Dermatology	চর্মরোগ	Skin rashes, itching, acne, allergies and hair loss.	চামড়ায় ফুসকুড়ি, চুলকানি, ব্রণ, এলার্জি ও চুল পড়া।	9	t
respiratory	Respiratory Medicine	বক্ষব্যাধি	Long-lasting cough, asthma, wheezing and lung problems.	দীর্ঘদিনের কাশি, হাঁপানি, বুকে সাঁই সাঁই শব্দ ও ফুসফুসের সমস্যা।	10	t
endocrinology	Diabetes & Endocrinology	ডায়াবেটিস ও হরমোন	Diabetes, thyroid and hormone problems.	ডায়াবেটিস, থাইরয়েড ও হরমোনের সমস্যা।	11	t
ophthalmology	Eye (Ophthalmology)	চক্ষু	Eye pain, redness and blurred vision.	চোখে ব্যথা, চোখ লাল হওয়া ও ঝাপসা দেখা।	12	t
psychiatry	Psychiatry	মানসিক স্বাস্থ্য	Anxiety, low mood, sleep problems and stress.	দুশ্চিন্তা, মন খারাপ, ঘুমের সমস্যা ও মানসিক চাপ।	13	t
urology	Kidney & Urology	কিডনি ও মূত্ররোগ	Burning urine, kidney stones and prostate problems.	প্রস্রাবে জ্বালাপোড়া, কিডনিতে পাথর ও প্রোস্টেটের সমস্যা।	14	t
\.


--
-- TOC entry 5111 (class 0 OID 16485)
-- Dependencies: 225
-- Data for Name: staff_user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.staff_user (id, name, username, password_hash, role, doctor_id, active) FROM stdin;
d2c88ca7-f2ab-24cc-5cc5-67313d450624	Hospital Admin	admin	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	admin	\N	t
176bed87-b982-4020-15af-90e63b9bb816	Front Desk	frontdesk	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	front_desk	\N	t
2181f467-3c68-4869-e7d3-2264900d2ff2	Dr. Mahmudul Hasan	dr.mahmudul	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	3243093c-d76e-5e4a-91ab-3f719f0f5f62	t
7f7d0f98-0b50-9697-188d-22b5acbff36e	Dr. Sharmin Akter	dr.sharmin	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	61951e7f-61d2-9b97-dbe4-39a7e113a7ce	t
16cfdfa9-a0c6-895e-a443-42f7fba47c01	Dr. Arifur Rahman	dr.arifur	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	61251c7b-6b04-88e3-03a4-4069fac25ba2	t
e4de816b-eb04-8e79-a010-252c11d87b86	Dr. Rezaul Karim	dr.rezaul	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	c2e6ca8c-1849-b126-862c-ffeac3389f81	t
eaee1d0a-9671-9edd-ee44-ad7126af69e4	Dr. Nadia Islam	dr.nadia	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	651e3b38-29ae-696d-9ccd-1549415906c1	t
6ad9fd21-d561-0c3f-9618-83d04cced385	Dr. Anisur Rahman	dr.anisur	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	3ae4fd5a-380b-1761-6f0b-e818487d4ce3	t
7fd3cf6c-b666-890f-5dad-2fc78a5a1d62	Dr. Lubna Yasmin	dr.lubna	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	00b67151-b942-1845-44d1-905beb4586bd	t
ce0e8eaf-4224-f490-eef4-a9c3144ae428	Dr. Tanvir Hasan	dr.tanvir	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	f0e1afe2-a689-4576-64d4-e230206f7535	t
a7454726-2781-0efc-3837-f908c219cfd8	Dr. Farzana Chowdhury	dr.farzana	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	de34546d-b5df-1ad4-efdf-7902801b9470	t
afb8a684-c645-c83d-a37d-8f74f5c101e2	Dr. Kamrul Islam	dr.kamrul	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	431d40d8-0987-7aae-07cd-3bc70f5c4e0d	t
bb48a44e-fa91-8c23-28b3-e6f523fd496e	Dr. Sabrina Haque	dr.sabrina	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	2d29a7f3-6732-88f6-aa3e-116d7ed87a9c	t
35a7220b-d470-52c7-5c6c-b27af741db1d	Dr. Rokeya Begum	dr.rokeya	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	3f6a0619-da20-b644-7d91-bb0f89f0a6a0	t
5411e46c-0280-1830-2748-05b1ba486713	Dr. Tahmina Ahmed	dr.tahmina	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	2ecbc9c5-e974-ad68-1761-d18cbfabcdf4	t
605eaec6-c7bd-b193-e170-93fd8e099324	Dr. Shafiqul Alam	dr.shafiqul	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	85ed390a-88ff-a86e-e786-d6f6387f07fc	t
b702e85a-b339-b8ad-3e5e-4839b7383b7c	Dr. Ishrat Jahan	dr.ishrat	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	f2aab5d3-ebf2-6368-550f-6a368d096280	t
b777be20-4772-b6a9-beb7-bab9bf975c7d	Dr. Abdul Mannan	dr.abdul	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	c0de9d1d-1cae-e027-9b7b-3a77ca7d832f	t
4506585d-bf84-c351-0357-b4f8531d331a	Dr. Sumaiya Rahman	dr.sumaiya	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	63b0ec29-c4ea-8745-3995-fc565731f829	t
3d91be90-3d82-f538-755b-04bdcf5eeb0c	Dr. Mizanur Rahman	dr.mizanur	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	2064393f-0ed3-ed94-8945-3ea1bcb25306	t
f3917850-78fd-6685-e872-1613201e860d	Dr. Shahana Parvin	dr.shahana	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	2fb41fee-924e-9831-4761-ed056289bf65	t
104211aa-64cb-270c-45bc-6c4c0fc04b61	Dr. Jahangir Alam	dr.jahangir	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	ac46d466-623c-d15d-2ec8-b500ed1d9918	t
2fd7c59e-2cf4-5214-f6e0-840a3cb5c428	Dr. Rafiqul Islam	dr.rafiqul	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	21f2cc13-263f-6356-2b65-1a45d2dd1ab9	t
7c169e8e-ffe7-0759-b43e-1ae33fb4830a	Dr. Moinul Hossain	dr.moinul	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	doctor	b0e57f07-bbda-a0f7-7044-5d7ab4bcfb93	t
\.


--
-- TOC entry 5110 (class 0 OID 16466)
-- Dependencies: 224
-- Data for Name: triage_session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.triage_session (id, patient_id, lang, problem, answers, status, specialty_id, urgency, explanation, tags, summary, created_at) FROM stdin;
02fd0613-d32d-3c29-b574-5ed3a0c06faa	6c1ac21a-2cf6-cd0b-f241-35136965443f	en	Stomach pain and acidity after meals for two weeks	[{"answer": "Moderate", "question": "How bad is it?"}]	complete	gastroenterology	routine	Burning stomach pain after meals is usually seen by a gastroenterologist.	{stomach_pain,acidity}	{"duration": "1–2 weeks", "severity": "Moderate", "symptoms": ["Stomach pain", "Acidity"]}	2026-11-21 20:42:03.640335+06
bac9e1da-09f9-0f01-a3e1-9e1fbd9f3ff9	53478790-910a-d1b1-dcd0-fdb3db42bd46	bn	প্রেশার বেড়েছে, মাঝে মাঝে বুক ধড়ফড় করে	[{"answer": "কয়েক দিন", "question": "কত দিন ধরে এই সমস্যা হচ্ছে?"}]	complete	cardiology	within_48h	উচ্চ রক্তচাপ ও বুক ধড়ফড় করার জন্য হৃদরোগ বিশেষজ্ঞ দেখানো উচিত।	{high_bp,palpitations}	{"duration": "কয়েক দিন", "severity": "মাঝারি", "symptoms": ["উচ্চ রক্তচাপ", "বুক ধড়ফড়"]}	2026-11-21 20:42:03.640335+06
6ce1a6df-e1e3-fb39-c3e1-5706f562b35e	\N	bn	হঠাৎ বুকে ব্যথা ও ঘাম হচ্ছে	[]	emergency	\N	\N	Emergency symptom detected.	{chest_pain}	\N	2026-11-21 20:42:03.640335+06
\.


--
-- TOC entry 4936 (class 2606 OID 16520)
-- Name: appointment appointment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT appointment_pkey PRIMARY KEY (id);


--
-- TOC entry 4917 (class 2606 OID 16410)
-- Name: doctor doctor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor
    ADD CONSTRAINT doctor_pkey PRIMARY KEY (id);


--
-- TOC entry 4921 (class 2606 OID 16447)
-- Name: leave_day leave_day_doctor_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_day
    ADD CONSTRAINT leave_day_doctor_id_date_key UNIQUE (doctor_id, date);


--
-- TOC entry 4923 (class 2606 OID 16445)
-- Name: leave_day leave_day_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_day
    ADD CONSTRAINT leave_day_pkey PRIMARY KEY (id);


--
-- TOC entry 4942 (class 2606 OID 16585)
-- Name: otp_code otp_code_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_code
    ADD CONSTRAINT otp_code_pkey PRIMARY KEY (phone);


--
-- TOC entry 4925 (class 2606 OID 16465)
-- Name: patient patient_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient
    ADD CONSTRAINT patient_phone_key UNIQUE (phone);


--
-- TOC entry 4927 (class 2606 OID 16463)
-- Name: patient patient_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient
    ADD CONSTRAINT patient_pkey PRIMARY KEY (id);


--
-- TOC entry 4938 (class 2606 OID 16549)
-- Name: queue_state queue_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queue_state
    ADD CONSTRAINT queue_state_pkey PRIMARY KEY (doctor_id, date);


--
-- TOC entry 4919 (class 2606 OID 16429)
-- Name: schedule_rule schedule_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_rule
    ADD CONSTRAINT schedule_rule_pkey PRIMARY KEY (id);


--
-- TOC entry 4944 (class 2606 OID 16593)
-- Name: setting setting_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.setting
    ADD CONSTRAINT setting_pkey PRIMARY KEY (key);


--
-- TOC entry 4940 (class 2606 OID 16569)
-- Name: sms_message sms_message_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_message
    ADD CONSTRAINT sms_message_pkey PRIMARY KEY (id);


--
-- TOC entry 4915 (class 2606 OID 16399)
-- Name: specialty specialty_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.specialty
    ADD CONSTRAINT specialty_pkey PRIMARY KEY (id);


--
-- TOC entry 4931 (class 2606 OID 16498)
-- Name: staff_user staff_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_user
    ADD CONSTRAINT staff_user_pkey PRIMARY KEY (id);


--
-- TOC entry 4933 (class 2606 OID 16500)
-- Name: staff_user staff_user_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_user
    ADD CONSTRAINT staff_user_username_key UNIQUE (username);


--
-- TOC entry 4929 (class 2606 OID 16474)
-- Name: triage_session triage_session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.triage_session
    ADD CONSTRAINT triage_session_pkey PRIMARY KEY (id);


--
-- TOC entry 4934 (class 1259 OID 16541)
-- Name: appointment_one_per_slot; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX appointment_one_per_slot ON public.appointment USING btree (doctor_id, date, start_time) WHERE (status <> 'cancelled'::text);


--
-- TOC entry 4951 (class 2606 OID 16526)
-- Name: appointment appointment_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT appointment_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctor(id);


--
-- TOC entry 4952 (class 2606 OID 16521)
-- Name: appointment appointment_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT appointment_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient(id);


--
-- TOC entry 4953 (class 2606 OID 16536)
-- Name: appointment appointment_rescheduled_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT appointment_rescheduled_from_id_fkey FOREIGN KEY (rescheduled_from_id) REFERENCES public.appointment(id);


--
-- TOC entry 4954 (class 2606 OID 16531)
-- Name: appointment appointment_triage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT appointment_triage_id_fkey FOREIGN KEY (triage_id) REFERENCES public.triage_session(id);


--
-- TOC entry 4945 (class 2606 OID 16411)
-- Name: doctor doctor_specialty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor
    ADD CONSTRAINT doctor_specialty_id_fkey FOREIGN KEY (specialty_id) REFERENCES public.specialty(id);


--
-- TOC entry 4947 (class 2606 OID 16448)
-- Name: leave_day leave_day_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_day
    ADD CONSTRAINT leave_day_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctor(id);


--
-- TOC entry 4955 (class 2606 OID 16550)
-- Name: queue_state queue_state_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queue_state
    ADD CONSTRAINT queue_state_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctor(id);


--
-- TOC entry 4956 (class 2606 OID 16555)
-- Name: queue_state queue_state_now_serving_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queue_state
    ADD CONSTRAINT queue_state_now_serving_id_fkey FOREIGN KEY (now_serving_id) REFERENCES public.appointment(id);


--
-- TOC entry 4946 (class 2606 OID 16430)
-- Name: schedule_rule schedule_rule_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_rule
    ADD CONSTRAINT schedule_rule_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctor(id);


--
-- TOC entry 4957 (class 2606 OID 16570)
-- Name: sms_message sms_message_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_message
    ADD CONSTRAINT sms_message_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointment(id);


--
-- TOC entry 4950 (class 2606 OID 16501)
-- Name: staff_user staff_user_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_user
    ADD CONSTRAINT staff_user_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctor(id);


--
-- TOC entry 4948 (class 2606 OID 16475)
-- Name: triage_session triage_session_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.triage_session
    ADD CONSTRAINT triage_session_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient(id);


--
-- TOC entry 4949 (class 2606 OID 16480)
-- Name: triage_session triage_session_specialty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.triage_session
    ADD CONSTRAINT triage_session_specialty_id_fkey FOREIGN KEY (specialty_id) REFERENCES public.specialty(id);


-- Completed on 2026-11-21 20:50:00

--
-- PostgreSQL database dump complete
--

\unrestrict bckeI0wDJ0fvEcEcSns7fmdkOfCoBmLqhoR9DL4xbrKkVSi72foKZdf1jA2PUTx

