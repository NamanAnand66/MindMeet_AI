import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { env, requireEnv } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { normalizeUtterances, transcriptToText } from "../utils/transcript.js";

let deepgramClient;

const getDeepgram = () => {
  if (!deepgramClient) {
    deepgramClient = createClient(requireEnv("DEEPGRAM_API_KEY"));
  }
  return deepgramClient;
};

export const transcribeRecordingUrl = async (audioUrl) => {
  const deepgram = getDeepgram();
  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: audioUrl },
    {
      model: "nova-2",
      smart_format: true,
      punctuate: true,
      diarize: true,
      utterances: true
    }
  );

  if (error) {
    throw new AppError("Deepgram transcription failed.", 502, error.message);
  }

  const utterances = result?.results?.utterances ?? [];
  const segments = normalizeUtterances(utterances);
  const text =
    transcriptToText(segments) ||
    result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ||
    "";

  return {
    provider: "deepgram",
    raw: result,
    segments,
    text,
    durationSeconds: result?.metadata?.duration ?? null
  };
};

export const createTemporaryDeepgramToken = async () => {
  const { result, error } = await getDeepgram().auth.grantToken();

  if (error || !result?.access_token) {
    throw new AppError(
      "Failed to create a temporary Deepgram live token.",
      502,
      error?.message || "Deepgram returned no access token."
    );
  }

  return {
    token: result.access_token,
    expiresIn: result.expires_in
  };
};

export const transcribeLiveChunk = async ({ buffer, offsetSeconds = 0 }) => {
  const { result, error } = await getDeepgram().listen.prerecorded.transcribeFile(buffer, {
    model: "nova-2",
    smart_format: true,
    punctuate: true,
    diarize: true,
    utterances: true
  });

  if (error) {
    throw new AppError("Deepgram live chunk transcription failed.", 502, error.message);
  }

  return normalizeUtterances(result?.results?.utterances ?? []).map((segment) => {
    const start = segment.start + offsetSeconds;
    const end = segment.end + offsetSeconds;
    return {
      ...segment,
      id: `${segment.id}-${Math.round(offsetSeconds * 1000)}`,
      start,
      end,
      timestamp: new Date(start * 1000).toISOString().slice(14, 19),
      isFinal: true
    };
  });
};

export const createLiveDeepgramConnection = ({ onTranscript, onError, onClose }) => {
  if (!env.DEEPGRAM_API_KEY) {
    throw new AppError("Deepgram API key is required for live meetings.", 500);
  }

  const connection = getDeepgram().listen.live({
    model: "nova-2",
    smart_format: true,
    punctuate: true,
    interim_results: true,
    diarize: true,
    utterance_end_ms: 1000
  });

  connection.on(LiveTranscriptionEvents.Transcript, onTranscript);
  connection.on(LiveTranscriptionEvents.Error, onError);
  connection.on(LiveTranscriptionEvents.Close, onClose);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      connection.finish?.();
      reject(new AppError("Timed out while connecting to Deepgram live transcription.", 504));
    }, 10000);

    connection.on(LiveTranscriptionEvents.Open, () => {
      clearTimeout(timeout);
      resolve(connection);
    });

    connection.on(LiveTranscriptionEvents.Error, (error) => {
      clearTimeout(timeout);
      reject(
        new AppError(
          "Failed to connect to Deepgram live transcription.",
          502,
          error?.message || "Deepgram websocket error"
        )
      );
    });
  });
};
