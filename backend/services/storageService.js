import { getSupabase, storageBucket } from "../config/supabase.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const allowedMimeTypes = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a"
];

let bucketReadyPromise;

export const ensureStorageBucket = async () => {
  bucketReadyPromise ||= (async () => {
    const supabase = getSupabase();
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      throw new AppError("Failed to inspect Supabase Storage buckets.", 502, listError.message);
    }

    if (buckets.some((bucket) => bucket.name === storageBucket)) {
      return storageBucket;
    }

    const { error: createError } = await supabase.storage.createBucket(storageBucket, {
      public: false,
      fileSizeLimit: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
      allowedMimeTypes
    });

    if (createError && !createError.message?.toLowerCase().includes("already exists")) {
      throw new AppError(
        `Failed to create Supabase Storage bucket "${storageBucket}".`,
        502,
        createError.message
      );
    }

    return storageBucket;
  })().catch((error) => {
    bucketReadyPromise = undefined;
    throw error;
  });

  return bucketReadyPromise;
};

export const uploadRecording = async ({ file, meetingId }) => {
  const supabase = getSupabase();
  await ensureStorageBucket();

  const extension = file.originalname.split(".").pop();
  const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${meetingId}/${Date.now()}-${safeFilename}`;

  const { error } = await supabase.storage.from(storageBucket).upload(path, file.buffer, {
    contentType: file.mimetype,
    upsert: false
  });

  if (error) {
    throw new AppError("Failed to upload recording to Supabase Storage.", 502, error.message);
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(path, 60 * 60);

  if (signedUrlError) {
    throw new AppError("Failed to create recording signed URL.", 502, signedUrlError.message);
  }

  return {
    path,
    signedUrl: signedUrlData.signedUrl,
    extension
  };
};

export const createRecordingUploadUrl = async ({ meetingId, filename }) => {
  const supabase = getSupabase();
  await ensureStorageBucket();

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${meetingId}/${Date.now()}-${safeFilename}`;
  const { data, error } = await supabase.storage.from(storageBucket).createSignedUploadUrl(path);

  if (error) {
    throw new AppError("Failed to create a signed recording upload URL.", 502, error.message);
  }

  return {
    path,
    signedUrl: data.signedUrl,
    token: data.token
  };
};

export const createRecordingReadUrl = async (path) => {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(storageBucket).createSignedUrl(path, 60 * 60);

  if (error) {
    throw new AppError("Failed to create recording signed URL.", 502, error.message);
  }

  return data.signedUrl;
};

export const deleteRecording = async (path) => {
  if (!path) return;

  const supabase = getSupabase();
  const { error } = await supabase.storage.from(storageBucket).remove([path]);
  if (error) {
    console.error(`Failed to remove recording "${path}": ${error.message}`);
  }
};
