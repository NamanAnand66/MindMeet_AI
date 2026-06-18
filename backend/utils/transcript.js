import { secondsToTimestamp } from "./time.js";

export const normalizeUtterances = (utterances = []) =>
  utterances.map((utterance, index) => ({
    id: `${Math.round((utterance.start ?? index) * 1000)}-${index}`,
    speaker: `Speaker ${Number(utterance.speaker ?? 0) + 1}`,
    start: Number(utterance.start ?? 0),
    end: Number(utterance.end ?? utterance.start ?? 0),
    timestamp: secondsToTimestamp(utterance.start ?? 0),
    text: utterance.transcript || utterance.text || ""
  }));

export const transcriptToText = (segments = []) =>
  segments.map((segment) => `[${segment.timestamp}] ${segment.speaker}: ${segment.text}`).join("\n");

export const calculateSpeakingTime = (segments = []) =>
  segments.reduce((totals, segment) => {
    const duration = Math.max(0, Number(segment.end ?? 0) - Number(segment.start ?? 0));
    totals[segment.speaker] = Number(((totals[segment.speaker] ?? 0) + duration).toFixed(2));
    return totals;
  }, {});
