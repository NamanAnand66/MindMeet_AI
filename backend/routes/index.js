import { Router } from "express";
import { analyticsRoutes } from "./analyticsRoutes.js";
import { chatRoutes } from "./chatRoutes.js";
import { meetingRoutes } from "./meetingRoutes.js";
import { uploadRoutes } from "./uploadRoutes.js";

export const apiRoutes = Router();

apiRoutes.get("/health", (_req, res) => {
  res.json({ success: true, status: "ok" });
});

apiRoutes.use("/upload", uploadRoutes);
apiRoutes.use("/meeting", meetingRoutes);
apiRoutes.use("/chat", chatRoutes);
apiRoutes.use("/analytics", analyticsRoutes);
