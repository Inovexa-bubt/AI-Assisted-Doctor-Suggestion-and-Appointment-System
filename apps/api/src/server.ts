
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";

import specialtyRoutes from "./routes/specialty.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import triageRoutes from "./routes/triage.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import authRoutes from "./routes/auth.routes.js";
import staffRoutes from "./routes/staff.routes.js";
import adminDoctorRoutes from "./routes/admin-doctor.routes.js";
import adminScheduleRoutes from "./routes/admin-schedule.routes.js";
import adminLeaveRoutes from "./routes/admin-leave.routes.js";
import adminSettingRoutes from "./routes/admin-setting.routes.js";
import frontdeskRoutes from "./routes/frontdesk.routes.js";
import frontdeskPatientRoutes from "./routes/frontdesk-patient.routes.js";
import doctorDashboardRoutes from "./routes/doctor-dashboard.routes.js";
import queueRoutes from "./routes/queue.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import speechRoutes from "./routes/speech.routes.js";

const app = express();
const httpServer = createServer(app);

const PORT = Number(process.env.PORT) || 4000;

const allowedOrigin =
  process.env.FRONTEND_URL || "http://localhost:5173";

app.use(helmet());

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

// Socket.IO configuration
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigin,
    credentials: true
  }
});

// Socket connection
io.on("connection", socket => {
  console.log(`Socket connected: ${socket.id}`);

  // Join a doctor's queue room
  socket.on("queue:join", (data: { doctorId?: string; date?: string }) => {
    if (
      typeof data?.doctorId !== "string" ||
      typeof data?.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.date)
    ) {
      return;
    }

    const room = `queue:${data.doctorId}:${data.date}`;

    socket.join(room);

    socket.emit("queue:joined", {
      message: "Successfully joined queue updates.",
      doctorId: data.doctorId,
      date: data.date
    });
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Make Socket.IO available to route handlers
app.set("io", io);

// Health check
app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Innovexa API is running",
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use("/api/v1/admin/doctors", adminDoctorRoutes);
app.use("/api/v1/admin/schedules", adminScheduleRoutes);
app.use("/api/v1/admin/leave-days", adminLeaveRoutes);
app.use("/api/v1/admin/settings", adminSettingRoutes);
app.use("/api/v1/admin/analytics", analyticsRoutes);

app.use("/api/v1/frontdesk", frontdeskRoutes);
app.use("/api/v1/frontdesk", frontdeskPatientRoutes);
app.use("/api/v1/doctor", doctorDashboardRoutes);

app.use("/api/v1/queue", queueRoutes);
app.use("/api/v1/speech", speechRoutes);

app.use("/api/v1/specialties", specialtyRoutes);
app.use("/api/v1/doctors", doctorRoutes);
app.use("/api/v1/triage", triageRoutes);
app.use("/api/v1/appointments", appointmentRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/staff", staffRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested endpoint was not found."
    }
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Innovexa API running at http://localhost:${PORT}`);
  console.log(`Socket.IO running on port ${PORT}`);
});
