
import {
  getDailyAppointments,
  updateAppointmentStatus,
  findFrontdeskAppointment
} from "./frontdesk.service.js";

export type QueueState = {
  doctorId: string;
  date: string;
  nowServingId: string | null;
  updatedAt: string;
};

export const queueStates: QueueState[] = [];

export function getQueueState(
  doctorId: string,
  date: string
): QueueState {
  let state = queueStates.find(
    item => item.doctorId === doctorId && item.date === date
  );

  if (!state) {
    state = {
      doctorId,
      date,
      nowServingId: null,
      updatedAt: new Date().toISOString()
    };

    queueStates.push(state);
  }

  return state;
}

export function getQueue(doctorId: string, date: string) {
  const appointments = getDailyAppointments(doctorId, date);

  const state = getQueueState(doctorId, date);

  return {
    doctorId,
    date,
    nowServing: state.nowServingId
      ? findFrontdeskAppointment(state.nowServingId) ?? null
      : null,
    waiting: appointments.filter(
      appointment =>
        appointment.status === "arrived" ||
        appointment.status === "booked"
    ),
    completed: appointments.filter(
      appointment => appointment.status === "seen"
    )
  };
}

export function callNextPatient(
  doctorId: string,
  date: string
) {
  const appointments = getDailyAppointments(doctorId, date);

  const nextPatient = appointments.find(
    appointment => appointment.status === "arrived"
  );

  if (!nextPatient) {
    return null;
  }

  const state = getQueueState(doctorId, date);

  const updated = updateAppointmentStatus(
    nextPatient.id,
    "in_consultation"
  );

  if (!updated) {
    return null;
  }

  state.nowServingId = updated.id;
  state.updatedAt = new Date().toISOString();

  return updated;
}
