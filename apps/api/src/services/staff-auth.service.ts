
import { randomUUID, scryptSync, timingSafeEqual } from "crypto";

export type StaffRole = "admin" | "front_desk" | "doctor";

export type StaffUser = {
  id: string;
  name: string;
  username: string;
  role: StaffRole;
  doctorId: string | null;
  passwordHash: Buffer;
};

const SALT = "innovexa-development-salt";

function hashPassword(password: string): Buffer {
  return scryptSync(password, SALT, 64);
}

export const staffUsers: StaffUser[] = [
  {
    id: "s_01",
    name: "Hospital Administrator",
    username: "admin",
    role: "admin",
    doctorId: null,
    passwordHash: hashPassword("Admin@123")
  },
  {
    id: "s_02",
    name: "Front Desk Staff",
    username: "reception",
    role: "front_desk",
    doctorId: null,
    passwordHash: hashPassword("Reception@123")
  },
  {
    id: "s_03",
    name: "Dr. Mahmud Rahman",
    username: "doctor",
    role: "doctor",
    doctorId: "d_03",
    passwordHash: hashPassword("Doctor@123")
  }
];

const staffSessions = new Map<string, string>();

export function authenticateStaff(
  username: string,
  password: string
): StaffUser | undefined {
  const staff = staffUsers.find(
    user => user.username === username
  );

  if (!staff) return undefined;

  const submittedHash = hashPassword(password);

  if (!timingSafeEqual(staff.passwordHash, submittedHash)) {
    return undefined;
  }

  return staff;
}

export function createStaffSession(staffId: string): string {
  const sessionId = randomUUID();
  staffSessions.set(sessionId, staffId);
  return sessionId;
}

export function getStaffBySession(
  sessionId: string
): StaffUser | undefined {
  const staffId = staffSessions.get(sessionId);

  if (!staffId) return undefined;

  return staffUsers.find(staff => staff.id === staffId);
}

export function destroyStaffSession(sessionId: string): void {
  staffSessions.delete(sessionId);
}

export function publicStaff(staff: StaffUser) {
  const { passwordHash, ...safeStaff } = staff;
  return safeStaff;
}
