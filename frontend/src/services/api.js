import axios from "axios";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const apiBaseUrl = configuredApiUrl || (import.meta.env.DEV ? "http://localhost:8080/api" : "");

const requireApiUrl = () => {
  if (!apiBaseUrl) {
    throw new Error(
      "The production API URL is not configured. Set VITE_API_URL to your deployed backend URL and redeploy the frontend."
    );
  }
};

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120000
});

export const uploadRecording = async ({ title, file, onUploadProgress }) => {
  requireApiUrl();
  const { data: preparedResponse } = await api.post("/upload/prepare", {
    title,
    filename: file.name,
    size: file.size,
    contentType: file.type
  });
  const prepared = preparedResponse.data;

  await axios.put(prepared.signedUrl, file, {
    headers: {
      "Content-Type": file.type || "application/octet-stream"
    },
    timeout: 10 * 60 * 1000,
    onUploadProgress
  });

  const { data } = await api.post(
    "/upload/process",
    {
      meetingId: prepared.meetingId,
      path: prepared.path
    },
    {
      timeout: 5 * 60 * 1000
    }
  );

  return data.data;
};

export const getAnalytics = async () => {
  requireApiUrl();
  const { data } = await api.get("/analytics");
  return data.data;
};

export const getMeeting = async (id) => {
  requireApiUrl();
  const { data } = await api.get(`/meeting/${id}`);
  return data.data;
};

export const askArchive = async ({ question, meetingId }) => {
  requireApiUrl();
  const { data } = await api.post("/chat", { question, meetingId });
  return data.data;
};

export const startLiveMeeting = async (title) => {
  requireApiUrl();
  const { data } = await api.post("/meeting/start", { title });
  return data.data;
};

export const getLiveMeetingToken = async () => {
  requireApiUrl();
  const { data } = await api.post("/meeting/live-token");
  return data.data;
};

export const endLiveMeeting = async ({ meetingId, segments }) => {
  requireApiUrl();
  const { data } = await api.post(
    "/meeting/end",
    { meetingId, segments },
    { timeout: 5 * 60 * 1000 }
  );
  return data.data;
};

export const cancelLiveMeeting = async (meetingId) => {
  if (!meetingId) return;
  requireApiUrl();
  await api.post("/meeting/cancel", { meetingId });
};

export const transcribeLiveChunk = async ({ meetingId, blob, offsetSeconds }) => {
  requireApiUrl();
  const formData = new FormData();
  formData.append("meetingId", meetingId);
  formData.append("offsetSeconds", String(offsetSeconds));
  formData.append("audio", blob, `live-${Date.now()}.webm`);

  const { data } = await api.post("/meeting/live-chunk", formData, {
    timeout: 60 * 1000
  });
  return data.data.segments;
};
