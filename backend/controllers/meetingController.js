import {
  abandonLiveMeeting,
  endLiveMeeting,
  ensureLiveMeeting,
  getMeetingById,
  startLiveMeeting
} from "../services/meetingService.js";
import {
  createTemporaryDeepgramToken,
  transcribeLiveChunk
} from "../services/deepgramService.js";
import { AppError } from "../utils/AppError.js";

export const startMeeting = async (req, res) => {
  const meeting = await startLiveMeeting({ title: req.body.title });
  res.status(201).json({ success: true, data: meeting });
};

export const endMeeting = async (req, res) => {
  const meeting = await endLiveMeeting({
    meetingId: req.body.meetingId,
    segments: req.body.segments ?? []
  });
  res.json({ success: true, data: meeting });
};

export const getMeeting = async (req, res) => {
  const meeting = await getMeetingById(req.params.id);
  res.json({ success: true, data: meeting });
};

export const getLiveMeetingToken = async (_req, res) => {
  const token = await createTemporaryDeepgramToken();
  res.json({ success: true, data: token });
};

export const cancelMeeting = async (req, res) => {
  await abandonLiveMeeting(req.body.meetingId);
  res.json({ success: true });
};

export const transcribeMeetingChunk = async (req, res) => {
  if (!req.file) {
    throw new AppError("Live audio chunk is required.", 400);
  }

  await ensureLiveMeeting(req.body.meetingId);
  const segments = await transcribeLiveChunk({
    buffer: req.file.buffer,
    offsetSeconds: Number(req.body.offsetSeconds ?? 0)
  });

  res.json({ success: true, data: { segments } });
};
