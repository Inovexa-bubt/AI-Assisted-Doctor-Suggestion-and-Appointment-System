
export type ScheduleRule = {
  id: string;
  doctorId: string;
  weekday: number;
  start: string;
  end: string;
  slotMinutes: number;
  maxPatients: number;
  room: string;
};

export const scheduleRules: ScheduleRule[] = [
  {
    id: "sch_01",
    doctorId: "d_01",
    weekday: 0,
    start: "17:00",
    end: "19:00",
    slotMinutes: 15,
    maxPatients: 8,
    room: "101"
  },
  {
    id: "sch_02",
    doctorId: "d_02",
    weekday: 2,
    start: "17:00",
    end: "19:00",
    slotMinutes: 15,
    maxPatients: 8,
    room: "102"
  },
  {
    id: "sch_03",
    doctorId: "d_03",
    weekday: 4,
    start: "17:00",
    end: "19:00",
    slotMinutes: 15,
    maxPatients: 8,
    room: "103"
  }
];

export function getAllSchedules(): ScheduleRule[] {
  return [...scheduleRules];
}

export function getDoctorSchedules(doctorId: string): ScheduleRule[] {
  return scheduleRules.filter(
    schedule => schedule.doctorId === doctorId
  );
}

export function findSchedule(id: string): ScheduleRule | undefined {
  return scheduleRules.find(schedule => schedule.id === id);
}

export function addSchedule(
  data: Omit<ScheduleRule, "id">
): ScheduleRule | null {
  const duplicate = scheduleRules.some(
    schedule =>
      schedule.doctorId === data.doctorId &&
      schedule.weekday === data.weekday &&
      schedule.start === data.start
  );

  if (duplicate) {
    return null;
  }

  const schedule: ScheduleRule = {
    id: `sch_${Date.now()}_${scheduleRules.length + 1}`,
    ...data
  };

  scheduleRules.push(schedule);

  return schedule;
}

export function updateSchedule(
  id: string,
  updates: Partial<Omit<ScheduleRule, "id">>
): ScheduleRule | null {
  const schedule = findSchedule(id);

  if (!schedule) {
    return null;
  }

  Object.assign(schedule, updates);

  return schedule;
}

export function deleteSchedule(id: string): boolean {
  const index = scheduleRules.findIndex(
    schedule => schedule.id === id
  );

  if (index === -1) {
    return false;
  }

  scheduleRules.splice(index, 1);

  return true;
}
