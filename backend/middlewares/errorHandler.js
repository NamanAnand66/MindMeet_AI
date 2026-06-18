import { AppError } from "../utils/AppError.js";

export const notFoundHandler = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

export const errorHandler = (error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    message: statusCode === 500 ? "Internal server error" : error.message
  };

  if (error.details) {
    response.details = error.details;
  }

  if (process.env.NODE_ENV !== "production") {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};
