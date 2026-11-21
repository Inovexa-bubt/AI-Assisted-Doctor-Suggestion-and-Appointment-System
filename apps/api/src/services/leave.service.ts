export type LeaveDay = {
  id: string;
  doctorId: string;
  date: string;
  reason: string;
};

export const leaveDays: LeaveDay[] = [];

export function getAllLeaveDays(): LeaveDay[] {
  return [...leaveDays];
}

export function getDoctorLeaveDays(doctorId: string): LeaveDay[] {
  return leaveDays.filter(leave => leave.doctorId === doctorId);
}

export function findLeave(id: string): LeaveDay | undefined {
  return leaveDays.find(leave => leave.id === id);
}

export function addLeave(
  data: Omit<LeaveDay, "id">
): LeaveDay | null {
  const duplicate = leaveDays.some(
    leave =>
      leave.doctorId === data.doctorId &&
      leave.date === data.date
  );

  if (duplicate) {
    return null;
  }

  const leave: LeaveDay = {
    id: `leave_${Date.now()}`,
    ...data
  };

  leaveDays.push(leave);

  return leave;
}

export function deleteLeave(id: string): boolean {
  const index = leaveDays.findIndex(leave => leave.id === id);

  if (index === -1) {
    return false;
  }

  leaveDays.splice(index, 1);

  return true;
}