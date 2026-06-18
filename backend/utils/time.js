export const secondsToTimestamp = (seconds = 0) => {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const remainingSeconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
};

export const nowIso = () => new Date().toISOString();
