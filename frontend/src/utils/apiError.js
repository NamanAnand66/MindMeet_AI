export const getApiErrorMessage = (error, fallback = "Something went wrong.") => {
  const message = error.response?.data?.message || error.message || fallback;
  const details = error.response?.data?.details;
  return details && details !== message ? `${message} ${details}` : message;
};
