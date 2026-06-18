import { createLiveDeepgramConnection } from "./deepgramService.js";
import { abandonLiveMeeting, endLiveMeeting, startLiveMeeting } from "./meetingService.js";

const socketMeetings = new Map();

const normalizeLiveAlternative = (payload) => {
  const alternative = payload.channel?.alternatives?.[0];
  const transcript = alternative?.transcript?.trim();
  if (!transcript) return null;

  const word = alternative.words?.[0];
  const speakerNumber = Number(word?.speaker ?? 0) + 1;
  const start = Number(word?.start ?? 0);
  const end = Number(alternative.words?.at(-1)?.end ?? start);

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    speaker: `Speaker ${speakerNumber}`,
    start,
    end,
    timestamp: new Date(start * 1000).toISOString().slice(14, 19),
    text: transcript,
    isFinal: Boolean(payload.is_final)
  };
};

export const initializeLiveMeetingSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on("start_live_meeting", async ({ title } = {}) => {
      let deepgram;
      try {
        const segments = [];
        let resolveClosed;
        const closed = new Promise((resolve) => {
          resolveClosed = resolve;
        });
        deepgram = await createLiveDeepgramConnection({
          onTranscript: (payload) => {
            const segment = normalizeLiveAlternative(payload);
            if (!segment) return;
            if (segment.isFinal) segments.push(segment);
            const meetingId = socketMeetings.get(socket.id)?.meeting.id;
            socket.emit("live_transcript", { meetingId, segment });
          },
          onError: (error) => {
            socket.emit("live_error", {
              message: error?.message || "Deepgram live transcription failed."
            });
          },
          onClose: () => {
            resolveClosed();
            socket.emit("live_closed");
          }
        });

        const meeting = await startLiveMeeting({ title: title || "Live meeting" });
        socketMeetings.set(socket.id, { meeting, deepgram, segments, closed });
        socket.emit("live_meeting_started", { meeting });
      } catch (error) {
        deepgram?.finish?.();
        socket.emit("live_error", {
          message: error.message,
          details: error.details
        });
      }
    });

    socket.on("audio_chunk", (chunk) => {
      const session = socketMeetings.get(socket.id);
      if (session?.deepgram?.send && chunk) {
        session.deepgram.send(chunk);
      }
    });

    socket.on("end_live_meeting", async () => {
      const session = socketMeetings.get(socket.id);
      if (!session) return;

      try {
        session.deepgram.finish?.();
        await Promise.race([
          session.closed,
          new Promise((resolve) => setTimeout(resolve, 2000))
        ]);
        const meeting = await endLiveMeeting({
          meetingId: session.meeting.id,
          segments: session.segments
        });
        socket.emit("live_meeting_ended", { meeting });
      } catch (error) {
        socket.emit("live_error", { message: error.message });
      } finally {
        socketMeetings.delete(socket.id);
      }
    });

    socket.on("disconnect", () => {
      const session = socketMeetings.get(socket.id);
      session?.deepgram?.finish?.();
      socketMeetings.delete(socket.id);
      void abandonLiveMeeting(session?.meeting.id);
    });
  });
};
