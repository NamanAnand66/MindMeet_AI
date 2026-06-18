import { useEffect, useRef, useState } from "react";
import {
  cancelLiveMeeting,
  endLiveMeeting,
  getLiveMeetingToken,
  startLiveMeeting,
  transcribeLiveChunk
} from "../services/api";

const createDeepgramUrl = () => {
  const params = new URLSearchParams({
    model: "nova-2",
    smart_format: "true",
    punctuate: "true",
    interim_results: "true",
    diarize: "true",
    utterance_end_ms: "1000"
  });
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
};

const timestamp = (seconds) => new Date(seconds * 1000).toISOString().slice(14, 19);

const normalizeDeepgramTranscript = (payload) => {
  if (payload.type !== "Results") return null;
  const alternative = payload.channel?.alternatives?.[0];
  const transcript = alternative?.transcript?.trim();
  if (!transcript) return null;

  const words = alternative.words ?? [];
  const firstWord = words[0];
  const lastWord = words.at(-1);
  const start = Number(firstWord?.start ?? payload.start ?? 0);
  const end = Number(lastWord?.end ?? start + Number(payload.duration ?? 0));

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    speaker: `Speaker ${Number(firstWord?.speaker ?? 0) + 1}`,
    start,
    end,
    timestamp: timestamp(start),
    text: transcript,
    isFinal: Boolean(payload.is_final)
  };
};

export const useLiveMeeting = () => {
  const socketRef = useRef(null);
  const recorderRef = useRef(null);
  const chunkTimerRef = useRef(null);
  const pendingChunksRef = useRef([]);
  const chunkOffsetRef = useRef(0);
  const meetingRef = useRef(null);
  const segmentsRef = useRef([]);
  const stopRequestedRef = useRef(false);
  const finalizedRef = useRef(false);
  const startedAtRef = useRef(0);
  const [meeting, setMeeting] = useState(null);
  const [segments, setSegments] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [transcriptionMode, setTranscriptionMode] = useState("");

  const releaseMedia = () => {
    recorderRef.current?.stream?.getTracks()?.forEach((track) => track.stop());
  };

  const addSegment = (segment) => {
    segmentsRef.current = [...segmentsRef.current, segment];
    setSegments(segmentsRef.current);
  };

  const finalizeMeeting = async () => {
    if (!meetingRef.current || finalizedRef.current) return;
    finalizedRef.current = true;
    setStatus("finalizing");

    try {
      const completedMeeting = await endLiveMeeting({
        meetingId: meetingRef.current.id,
        segments: segmentsRef.current
      });
      setMeeting(completedMeeting);
      setStatus("completed");
    } catch (finalizeError) {
      setError(finalizeError.response?.data?.message || finalizeError.message);
      setStatus("error");
    }
  };

  useEffect(() => () => {
    releaseMedia();
    socketRef.current?.close();
    window.clearTimeout(chunkTimerRef.current);
    if (meetingRef.current && !finalizedRef.current) {
      void cancelLiveMeeting(meetingRef.current.id);
    }
  }, []);

  const startDeepgram = ({ stream, token }) => {
    const socket = new WebSocket(createDeepgramUrl(), ["token", token]);
    socketRef.current = socket;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
        socket.send(await event.data.arrayBuffer());
      }
    };

    recorder.onstop = () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "Finalize" }));
        window.setTimeout(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "CloseStream" }));
          }
        }, 900);
      } else {
        void finalizeMeeting();
      }
    };

    socket.onopen = () => {
      recorder.start(250);
      setTranscriptionMode("Deepgram live");
      setStatus("recording");
    };

    socket.onmessage = (event) => {
      const segment = normalizeDeepgramTranscript(JSON.parse(event.data));
      if (segment?.isFinal) addSegment(segment);
    };

    socket.onerror = () => {
      releaseMedia();
      void cancelLiveMeeting(meetingRef.current?.id);
      setError("Unable to connect to Deepgram live transcription.");
      setStatus("error");
    };

    socket.onclose = () => {
      releaseMedia();
      if (stopRequestedRef.current) void finalizeMeeting();
    };
  };

  const startChunkedDeepgram = (stream) => {
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recordChunk = () => {
      if (stopRequestedRef.current) return;

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      const parts = [];
      const chunkStart = Date.now();
      const offsetSeconds = chunkOffsetRef.current;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) parts.push(event.data);
      };

      recorder.onstop = () => {
        const durationSeconds = Math.max(0.1, (Date.now() - chunkStart) / 1000);
        chunkOffsetRef.current += durationSeconds;
        const blob = new Blob(parts, { type: mimeType });

        if (!stopRequestedRef.current) recordChunk();

        if (blob.size > 0) {
          const request = transcribeLiveChunk({
            meetingId: meetingRef.current.id,
            blob,
            offsetSeconds
          })
            .then((chunkSegments) => {
              const merged = [...segmentsRef.current, ...chunkSegments]
                .sort((a, b) => a.start - b.start);
              segmentsRef.current = merged;
              setSegments(merged);
            })
            .catch((chunkError) => {
              setError(chunkError.response?.data?.message || chunkError.message);
            });
          pendingChunksRef.current.push(request);
        }

        if (stopRequestedRef.current) {
          void Promise.allSettled(pendingChunksRef.current).then(finalizeMeeting);
        }
      };

      recorder.start();
      chunkTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 4000);
    };

    startedAtRef.current = Date.now();
    setTranscriptionMode("Deepgram Vercel stream");
    setStatus("recording");
    recordChunk();
  };

  const start = async (title) => {
    setError("");
    setSegments([]);
    setTranscriptionMode("");
    segmentsRef.current = [];
    pendingChunksRef.current = [];
    chunkOffsetRef.current = 0;
    stopRequestedRef.current = false;
    finalizedRef.current = false;
    setStatus("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let tokenData;
      try {
        tokenData = await getLiveMeetingToken();
      } catch {
        tokenData = null;
      }

      const preparedMeeting = await startLiveMeeting(title || "Live meeting");
      meetingRef.current = preparedMeeting;
      setMeeting(preparedMeeting);

      if (tokenData?.token) {
        startDeepgram({ stream, token: tokenData.token });
      } else {
        startChunkedDeepgram(stream);
      }
    } catch (startError) {
      releaseMedia();
      if (meetingRef.current && !finalizedRef.current) {
        void cancelLiveMeeting(meetingRef.current.id);
      }
      const permissionDenied = startError?.name === "NotAllowedError";
      setError(
        permissionDenied
          ? "Microphone permission was denied. Allow microphone access and try again."
          : startError.response?.data?.message || startError.message || "Unable to start the live meeting."
      );
      setStatus("error");
    }
  };

  const stop = () => {
    stopRequestedRef.current = true;
    setStatus("finalizing");

    if (recorderRef.current?.state === "recording") {
      window.clearTimeout(chunkTimerRef.current);
      recorderRef.current.stop();
    } else {
      void finalizeMeeting();
    }
    releaseMedia();
  };

  return {
    meeting,
    segments,
    status,
    error,
    start,
    stop,
    liveMeetingEnabled: true,
    transcriptionMode
  };
};
