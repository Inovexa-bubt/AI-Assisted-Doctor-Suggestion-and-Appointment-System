
import { frontdeskAppointments } from "./frontdesk.service.js";
import { getAllDoctors } from "./doctor.service.js";
import { getAllPatients } from "./patient.service.js";

export function getAppointmentAnalytics(date?: string) {
  const appointments = date
    ? frontdeskAppointments.filter(item => item.date === date)
    : frontdeskAppointments;

  return {
    total: appointments.length,
    booked: appointments.filter(item => item.status === "booked").length,
    arrived: appointments.filter(item => item.status === "arrived").length,
    inConsultation: appointments.filter(
      item => item.status === "in_consultation"
    ).length,
    completed: appointments.filter(item => item.status === "seen").length,
    cancelled: appointments.filter(item => item.status === "cancelled").length,
    noShow: appointments.filter(item => item.status === "no_show").length
  };
}

export function getDoctorAnalytics() {
  const doctors = getAllDoctors();

  return doctors.map(doctor => {
    const appointments = frontdeskAppointments.filter(
      item => item.doctorId === doctor.id
    );

    return {
      doctorId: doctor.id,
      doctorName: doctor.name_en,
      specialtyId: doctor.specialtyId,
      totalAppointments: appointments.length,
      completedAppointments: appointments.filter(
        item => item.status === "seen"
      ).length,
      active: doctor.active
    };
  });
}

export function getPatientAnalytics() {
  const patients = getAllPatients();

  return {
    totalPatients: patients.length,
    malePatients: patients.filter(patient => patient.sex === "male").length,
    femalePatients: patients.filter(patient => patient.sex === "female").length,
    otherPatients: patients.filter(patient => patient.sex === "other").length
  };
}

export function getDashboardAnalytics(date?: string) {
  return {
    appointments: getAppointmentAnalytics(date),
    patients: getPatientAnalytics(),
    doctors: {
      total: getAllDoctors().length,
      active: getAllDoctors().filter(doctor => doctor.active).length
    },
    doctorPerformance: getDoctorAnalytics()
  };
}
