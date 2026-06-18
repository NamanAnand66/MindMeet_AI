import multer from "multer";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const allowedMimeTypes = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a"
]);

export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new AppError("Only mp3, wav, and m4a audio files are supported.", 400));
      return;
    }
    cb(null, true);
  }
});

export const liveAudioChunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!["audio/webm", "video/webm", "audio/wav", "audio/x-wav"].includes(file.mimetype)) {
      cb(new AppError("Live audio chunks must use WebM or WAV audio.", 400));
      return;
    }
    cb(null, true);
  }
});
