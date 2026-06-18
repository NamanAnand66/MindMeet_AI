import { getSupabase } from "../config/supabase.js";
import { AppError } from "../utils/AppError.js";
import { calculateSpeakingTime, transcriptToText } from "../utils/transcript.js";
import { transcribeRecordingUrl } from "./deepgramService.js";
import { extractActionItems, summarizeMeeting } from "./llmRouter.js";
import { indexMeetingTranscript } from "./ragService.js";
import {
  createRecordingReadUrl,
  createRecordingUploadUrl,
  deleteRecording,
  uploadRecording
} from "./storageService.js";

export const createMeeting = async ({ title = "Untitled meeting", source = "upload", status = "processing" }) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .insert({ title, source, status })
    .select()
    .single();

  if (error) {
    throw new AppError("Failed to create meeting.", 502, error.message);
  }

  return data;
};

export const processUploadedMeeting = async ({ file, title }) => {
  const supabase = getSupabase();
  const meeting = await createMeeting({ title, source: "upload" });
  let recording;

  try {
    recording = await uploadRecording({ file, meetingId: meeting.id });
    const transcription = await transcribeRecordingUrl(recording.signedUrl);
    const transcriptText = transcription.text || transcriptToText(transcription.segments);

    if (!transcriptText.trim()) {
      throw new AppError("Deepgram returned an empty transcript for this recording.", 422);
    }

    const [{ summary }, { actionItems }] = await Promise.all([
      summarizeMeeting(transcriptText),
      extractActionItems(transcriptText)
    ]);

    const speakingTime = calculateSpeakingTime(transcription.segments);
    const operations = [
      supabase.from("meetings").update({
        status: "completed",
        storage_path: recording.path,
        duration_seconds: transcription.durationSeconds
      }).eq("id", meeting.id),
      supabase.from("transcripts").insert({
        meeting_id: meeting.id,
        provider: transcription.provider,
        text: transcriptText,
        segments: transcription.segments,
        raw_response: transcription.raw
      }),
      supabase.from("summaries").insert({
        meeting_id: meeting.id,
        content: summary
      }),
      actionItems.length
        ? supabase.from("action_items").insert(actionItems.map((item) => ({ ...item, meeting_id: meeting.id })))
        : Promise.resolve({ error: null }),
      supabase.from("analytics").insert({
        meeting_id: meeting.id,
        speaking_time_by_speaker: speakingTime,
        recurring_topics: summary.discussionPoints?.slice(0, 6) ?? []
      })
    ];

    const results = await Promise.all(operations);
    const failed = results.find((result) => result.error);
    if (failed) {
      throw new AppError("Failed to persist meeting intelligence.", 502, failed.error.message);
    }

    await indexMeetingTranscript({ meetingId: meeting.id, transcriptText });
    return getMeetingById(meeting.id);
  } catch (error) {
    await deleteRecording(recording?.path);
    await supabase.from("meetings").delete().eq("id", meeting.id);
    throw error;
  }
};

export const prepareUploadedMeeting = async ({ title, filename }) => {
  const meeting = await createMeeting({ title: title || filename, source: "upload" });

  try {
    const upload = await createRecordingUploadUrl({
      meetingId: meeting.id,
      filename
    });

    return {
      meetingId: meeting.id,
      path: upload.path,
      signedUrl: upload.signedUrl,
      token: upload.token
    };
  } catch (error) {
    const supabase = getSupabase();
    await supabase.from("meetings").delete().eq("id", meeting.id);
    throw error;
  }
};

export const processStoredMeeting = async ({ meetingId, path }) => {
  const supabase = getSupabase();
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id,status")
    .eq("id", meetingId)
    .eq("source", "upload")
    .single();

  if (meetingError || !meeting) {
    throw new AppError("Prepared meeting not found.", 404, meetingError?.message);
  }

  try {
    const signedUrl = await createRecordingReadUrl(path);
    const transcription = await transcribeRecordingUrl(signedUrl);
    const transcriptText = transcription.text || transcriptToText(transcription.segments);

    if (!transcriptText.trim()) {
      throw new AppError("Deepgram returned an empty transcript for this recording.", 422);
    }

    const [{ summary }, { actionItems }] = await Promise.all([
      summarizeMeeting(transcriptText),
      extractActionItems(transcriptText)
    ]);

    const speakingTime = calculateSpeakingTime(transcription.segments);
    const operations = [
      supabase.from("meetings").update({
        status: "completed",
        storage_path: path,
        duration_seconds: transcription.durationSeconds
      }).eq("id", meetingId),
      supabase.from("transcripts").insert({
        meeting_id: meetingId,
        provider: transcription.provider,
        text: transcriptText,
        segments: transcription.segments,
        raw_response: transcription.raw
      }),
      supabase.from("summaries").insert({
        meeting_id: meetingId,
        content: summary
      }),
      actionItems.length
        ? supabase.from("action_items").insert(actionItems.map((item) => ({ ...item, meeting_id: meetingId })))
        : Promise.resolve({ error: null }),
      supabase.from("analytics").insert({
        meeting_id: meetingId,
        speaking_time_by_speaker: speakingTime,
        recurring_topics: summary.discussionPoints?.slice(0, 6) ?? []
      })
    ];

    const results = await Promise.all(operations);
    const failed = results.find((result) => result.error);
    if (failed) {
      throw new AppError("Failed to persist meeting intelligence.", 502, failed.error.message);
    }

    await indexMeetingTranscript({ meetingId, transcriptText });
    return getMeetingById(meetingId);
  } catch (error) {
    await deleteRecording(path);
    await supabase.from("meetings").delete().eq("id", meetingId);
    throw error;
  }
};

export const getMeetingById = async (meetingId) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .select(`
      *,
      transcripts(id, meeting_id, provider, text, segments, created_at),
      summaries(*),
      action_items(*),
      analytics(*)
    `)
    .eq("id", meetingId)
    .single();

  if (error) {
    throw new AppError("Meeting not found.", 404, error.message);
  }

  return data;
};

export const startLiveMeeting = async ({ title }) => createMeeting({ title, source: "live", status: "live" });

export const ensureLiveMeeting = async (meetingId) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .eq("source", "live")
    .eq("status", "live")
    .single();

  if (error || !data) {
    throw new AppError("Active live meeting not found.", 404, error?.message);
  }
};

export const abandonLiveMeeting = async (meetingId) => {
  if (!meetingId) return;
  const supabase = getSupabase();
  await supabase.from("meetings").update({ status: "failed" }).eq("id", meetingId).eq("status", "live");
};

export const endLiveMeeting = async ({ meetingId, segments }) => {
  const supabase = getSupabase();
  const transcriptText = transcriptToText(segments);

  if (!transcriptText.trim()) {
    await supabase.from("meetings").update({ status: "failed" }).eq("id", meetingId);
    throw new AppError("No speech was transcribed. Check microphone access and try again.", 422);
  }

  const [{ summary }, { actionItems }] = await Promise.all([
    summarizeMeeting(transcriptText),
    extractActionItems(transcriptText)
  ]);

  const durationSeconds = Math.max(...segments.map((segment) => Number(segment.end ?? 0)), 0);
  const speakingTime = calculateSpeakingTime(segments);

  const operations = [
    supabase.from("meetings").update({ status: "completed", duration_seconds: durationSeconds }).eq("id", meetingId),
    supabase.from("transcripts").insert({ meeting_id: meetingId, provider: "deepgram-live", text: transcriptText, segments }),
    supabase.from("summaries").insert({ meeting_id: meetingId, content: summary }),
    actionItems.length
      ? supabase.from("action_items").insert(actionItems.map((item) => ({ ...item, meeting_id: meetingId })))
      : Promise.resolve({ error: null }),
    supabase.from("analytics").insert({
      meeting_id: meetingId,
      speaking_time_by_speaker: speakingTime,
      recurring_topics: summary.discussionPoints?.slice(0, 6) ?? []
    })
  ];

  const results = await Promise.all(operations);
  const failed = results.find((result) => result.error);
  if (failed) {
    throw new AppError("Failed to finalize live meeting.", 502, failed.error.message);
  }

  await indexMeetingTranscript({ meetingId, transcriptText });
  return getMeetingById(meetingId);
};
