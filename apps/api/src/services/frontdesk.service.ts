
export type FrontdeskAppointmentStatus =
  | "booked"
  | "arrived"
  | "in_consultation"
  | "seen"
  | "no_show"
  | "cancelled";

export type FrontdeskAppointment = {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  date: string;
  start: string;
  end: string;
  serial: number;
  status: FrontdeskAppointmentStatus;
};

export const frontdeskAppointments: FrontdeskAppointment[] = [
  {
    id: "fd_001",
    patientId: "p_001",
    patientName: "Rahim Ahmed",
    patientPhone: "01712345678",
    doctorId: "d_03",
    date: "2026-11-22",
    start: "17:00",
    end: "17:15",
    serial: 1,
    status: "booked"
  },
  {
    id: "fd_002",
    patientId: "p_002",
    patientName: "Nusrat Jahan",
    patientPhone: "01812345678",
    doctorId: "d_03",
    date: "2026-11-22",
    start: "17:15",
    end: "17:30",
    serial: 2,
    status: "booked"
  }
];

export function getDailyAppointments(
  doctorId: string,
  date: string
): FrontdeskAppointment[] {
  return frontdeskAppointments
    .filter(
      appointment =>
        appointment.doctorId === doctorId &&
        appointment.date === date &&
        appointment.status !== "cancelled"
    )
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function findFrontdeskAppointment(
  id: string
): FrontdeskAppointment | undefined {
  return frontdeskAppointments.find(
    appointment => appointment.id === id
  );
}

export function updateAppointmentStatus(
  id: string,
  status: FrontdeskAppointmentStatus
): FrontdeskAppointment | null {
  const appointment = findFrontdeskAppointment(id);

  if (!appointment) {
    return null;
  }

  appointment.status = status;

  return appointment;
}
