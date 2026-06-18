import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { apiRoutes } from "./routes/index.js";

const app = express();
const allowedOrigins = env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`Origin not allowed by CORS: ${origin}`));
};

app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/api", apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export { allowedOrigins, app, corsOrigin };
export default app;
