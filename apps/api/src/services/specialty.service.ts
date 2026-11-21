
export type Specialty = {
  id: string;
  name_en: string;
  name_bn: string;
  description_en: string;
  description_bn: string;
  sortOrder: number;
  active: boolean;
};

// Temporary shared data until database integration
export const specialties: Specialty[] = [
  {
    id: "cardiology",
    name_en: "Cardiology",
    name_bn: "হৃদরোগ বিভাগ",
    description_en: "Heart and blood vessel care",
    description_bn: "হৃদযন্ত্র ও রক্তনালীর চিকিৎসা",
    sortOrder: 1,
    active: true
  },
  {
    id: "neurology",
    name_en: "Neurology",
    name_bn: "স্নায়ুরোগ বিভাগ",
    description_en: "Brain and nervous system care",
    description_bn: "মস্তিষ্ক ও স্নায়ুতন্ত্রের চিকিৎসা",
    sortOrder: 2,
    active: true
  },
  {
    id: "gastroenterology",
    name_en: "Gastroenterology",
    name_bn: "পরিপাকতন্ত্র বিভাগ",
    description_en: "Digestive system care",
    description_bn: "পরিপাকতন্ত্রের চিকিৎসা",
    sortOrder: 3,
    active: true
  },
  {
    id: "dermatology",
    name_en: "Dermatology",
    name_bn: "চর্মরোগ বিভাগ",
    description_en: "Skin and hair care",
    description_bn: "ত্বক ও চুলের চিকিৎসা",
    sortOrder: 4,
    active: true
  },
  {
    id: "orthopedics",
    name_en: "Orthopedics",
    name_bn: "অর্থোপেডিক বিভাগ",
    description_en: "Bone and joint care",
    description_bn: "হাড় ও জয়েন্টের চিকিৎসা",
    sortOrder: 5,
    active: true
  }
];

export function getAllSpecialties(): Specialty[] {
  return [...specialties].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getActiveSpecialties(): Specialty[] {
  return getAllSpecialties().filter(specialty => specialty.active);
}

export function findSpecialty(id: string): Specialty | undefined {
  return specialties.find(specialty => specialty.id === id);
}

export function addSpecialty(
  data: Omit<Specialty, "active">
): Specialty | null {
  if (findSpecialty(data.id)) {
    return null;
  }

  const specialty: Specialty = {
    ...data,
    active: true
  };

  specialties.push(specialty);
  return specialty;
}

export function updateSpecialty(
  id: string,
  updates: Partial<Omit<Specialty, "id">>
): Specialty | null {
  const specialty = findSpecialty(id);

  if (!specialty) {
    return null;
  }

  Object.assign(specialty, updates);
  return specialty;
}

export function deactivateSpecialty(id: string): Specialty | null {
  const specialty = findSpecialty(id);

  if (!specialty) {
    return null;
  }

  specialty.active = false;
  return specialty;
}
