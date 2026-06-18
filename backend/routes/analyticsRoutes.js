import { Router } from "express";
import { getAnalyticsDashboard } from "../controllers/analyticsController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const analyticsRoutes = Router();

analyticsRoutes.get("/", asyncHandler(getAnalyticsDashboard));
