
import { Request, Response, NextFunction } from "express";
import {
  getStaffBySession,
  StaffRole
} from "../services/staff-auth.service.js";

export interface StaffRequest extends Request {
  staff?: {
    id: string;
    role: StaffRole;
    doctorId: string | null;
  };
}

export function requireStaff(allowedRoles?: StaffRole[]) {
  return (
    req: StaffRequest,
    res: Response,
    next: NextFunction
  ) => {
    const sessionId = req.cookies?.staff_sid;

    if (!sessionId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Staff login required."
        }
      });
    }

    const staff = getStaffBySession(sessionId);

    if (!staff) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Invalid staff session."
        }
      });
    }

    if (allowedRoles && !allowedRoles.includes(staff.role)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to access this resource."
        }
      });
    }

    req.staff = {
      id: staff.id,
      role: staff.role,
      doctorId: staff.doctorId
    };

    next();
  };
}
