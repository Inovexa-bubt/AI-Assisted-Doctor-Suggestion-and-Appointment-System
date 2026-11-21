
export type Doctor = {
  id: string;
  name_en: string;
  name_bn: string;
  specialtyId: string;
  designation_en: string;
  designation_bn: string;
  qualifications: string;
  experienceYears: number;
  fee: number;
  gender: "male" | "female" | "other";
  active: boolean;
};

// Temporary sample data until PostgreSQL integration
export const doctors: Doctor[] = [
  {
    id: "d_01",
    name_en: "Dr. Tanvir Hasan",
    name_bn: "ডা. তানভীর হাসান",
    specialtyId: "cardiology",
    designation_en: "Consultant Cardiologist",
    designation_bn: "কনসালটেন্ট হৃদরোগ বিশেষজ্ঞ",
    qualifications: "MBBS, MD (Cardiology)",
    experienceYears: 12,
    fee: 1000,
    gender: "male",
    active: true
  },
  {
    id: "d_02",
    name_en: "Dr. Nusrat Jahan",
    name_bn: "ডা. নুসরাত জাহান",
    specialtyId: "neurology",
    designation_en: "Neurology Specialist",
    designation_bn: "স্নায়ুরোগ বিশেষজ্ঞ",
    qualifications: "MBBS, FCPS (Medicine)",
    experienceYears: 10,
    fee: 1200,
    gender: "female",
    active: true
  },
  {
    id: "d_03",
    name_en: "Dr. Mahmud Rahman",
    name_bn: "ডা. মাহমুদ রহমান",
    specialtyId: "gastroenterology",
    designation_en: "Gastroenterologist",
    designation_bn: "পরিপাকতন্ত্র বিশেষজ্ঞ",
    qualifications: "MBBS, MD (Gastroenterology)",
    experienceYears: 8,
    fee: 900,
    gender: "male",
    active: true
  },
  {
    id: "d_04",
    name_en: "Dr. Farzana Akter",
    name_bn: "ডা. ফারজানা আক্তার",
    specialtyId: "dermatology",
    designation_en: "Dermatologist",
    designation_bn: "চর্মরোগ বিশেষজ্ঞ",
    qualifications: "MBBS, DDV",
    experienceYears: 7,
    fee: 800,
    gender: "female",
    active: true
  }
];

export function getAllDoctors(): Doctor[] {
  return [...doctors];
}

export function getActiveDoctors(): Doctor[] {
  return doctors.filter(doctor => doctor.active);
}

export function findDoctor(id: string): Doctor | undefined {
  return doctors.find(doctor => doctor.id === id);
}

export function addDoctor(data: Omit<Doctor, "active">): Doctor | null {
  if (findDoctor(data.id)) {
    return null;
  }

  const doctor: Doctor = {
    ...data,
    active: true
  };

  doctors.push(doctor);
  return doctor;
}

export function updateDoctor(
  id: string,
  updates: Partial<Omit<Doctor, "id">>
): Doctor | null {
  const doctor = findDoctor(id);

  if (!doctor) {
    return null;
  }

  Object.assign(doctor, updates);
  return doctor;
}

export function deactivateDoctor(id: string): Doctor | null {
  const doctor = findDoctor(id);

  if (!doctor) {
    return null;
  }

  doctor.active = false;
  return doctor;
}
