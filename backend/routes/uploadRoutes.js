import { Router } from "express";
import {
  prepareMeetingUpload,
  processMeetingUpload,
  uploadMeetingRecording
} from "../controllers/uploadController.js";
import { audioUpload } from "../middlewares/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const uploadRoutes = Router();

uploadRoutes.post("/", audioUpload.single("audio"), asyncHandler(uploadMeetingRecording));
uploadRoutes.post("/prepare", asyncHandler(prepareMeetingUpload));
uploadRoutes.post("/process", asyncHandler(processMeetingUpload));
