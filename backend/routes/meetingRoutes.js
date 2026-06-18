import { Router } from "express";
import {
  cancelMeeting,
  endMeeting,
  getLiveMeetingToken,
  getMeeting,
  startMeeting,
  transcribeMeetingChunk
} from "../controllers/meetingController.js";
import { liveAudioChunkUpload } from "../middlewares/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const meetingRoutes = Router();

meetingRoutes.post("/start", asyncHandler(startMeeting));
meetingRoutes.post("/end", asyncHandler(endMeeting));
meetingRoutes.post("/cancel", asyncHandler(cancelMeeting));
meetingRoutes.post("/live-token", asyncHandler(getLiveMeetingToken));
meetingRoutes.post(
  "/live-chunk",
  liveAudioChunkUpload.single("audio"),
  asyncHandler(transcribeMeetingChunk)
);
meetingRoutes.get("/:id", asyncHandler(getMeeting));
