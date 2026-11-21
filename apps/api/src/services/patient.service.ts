
export type Patient = {
  id: string;
  name: string;
  phone: string;
  age: number;
  sex: "male" | "female" | "other";
  registeredBy: string;
  createdAt: string;
};

export const patients: Patient[] = [
  {
    id: "p_001",
    name: "Rahim Ahmed",
    phone: "01712345678",
    age: 35,
    sex: "male",
    registeredBy: "front_desk",
    createdAt: new Date().toISOString()
  },
  {
    id: "p_002",
    name: "Nusrat Jahan",
    phone: "01812345678",
    age: 28,
    sex: "female",
    registeredBy: "front_desk",
    createdAt: new Date().toISOString()
  }
];

export function getAllPatients(): Patient[] {
  return [...patients];
}

export function findPatient(id: string): Patient | undefined {
  return patients.find(patient => patient.id === id);
}

export function searchPatients(query: string): Patient[] {
  const normalized = query.toLowerCase().trim();

  return patients.filter(
    patient =>
      patient.name.toLowerCase().includes(normalized) ||
      patient.phone.includes(normalized)
  );
}

export function findPatientByPhone(phone: string): Patient | undefined {
  return patients.find(patient => patient.phone === phone);
}

export function addPatient(
  data: Omit<Patient, "id" | "createdAt">
): Patient | null {
  if (findPatientByPhone(data.phone)) {
    return null;
  }

  const patient: Patient = {
    id: `p_${Date.now()}`,
    ...data,
    createdAt: new Date().toISOString()
  };

  patients.push(patient);

  return patient;
}
