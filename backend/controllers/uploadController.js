import { AppError } from "../utils/AppError.js";
import {
  prepareUploadedMeeting,
  processStoredMeeting,
  processUploadedMeeting
} from "../services/meetingService.js";

export const uploadMeetingRecording = async (req, res) => {
  if (!req.file) {
    throw new AppError("Audio file is required.", 400);
  }

  const meeting = await processUploadedMeeting({
    file: req.file,
    title: req.body.title || req.file.originalname
  });

  res.status(201).json({ success: true, data: meeting });
};

export const prepareMeetingUpload = async (req, res) => {
  const { title, filename, size } = req.body;
  if (!filename) {
    throw new AppError("Recording filename is required.", 400);
  }

  if (Number(size) > 50 * 1024 * 1024) {
    throw new AppError("Recording exceeds the 50 MB upload limit.", 413);
  }

  const upload = await prepareUploadedMeeting({ title, filename });
  res.status(201).json({ success: true, data: upload });
};

export const processMeetingUpload = async (req, res) => {
  const { meetingId, path } = req.body;
  if (!meetingId || !path) {
    throw new AppError("Meeting ID and storage path are required.", 400);
  }

  if (!path.startsWith(`${meetingId}/`)) {
    throw new AppError("Storage path does not belong to this meeting.", 400);
  }

  const meeting = await processStoredMeeting({ meetingId, path });
  res.status(201).json({ success: true, data: meeting });
};
