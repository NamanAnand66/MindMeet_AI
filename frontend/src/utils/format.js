export const formatSeconds = (seconds = 0) => {
  const total = Math.round(Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const remaining = String(total % 60).padStart(2, "0");
  return `${minutes}:${remaining}`;
};

export const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value))
    : "Not available";
