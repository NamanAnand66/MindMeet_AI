import http from "node:http";
import { Server } from "socket.io";
import app, { corsOrigin } from "./app.js";
import { env } from "./config/env.js";
import { initializeLiveMeetingSocket } from "./services/liveMeetingService.js";

if (!process.env.VERCEL) {
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e7
  });

  initializeLiveMeetingSocket(io);
  server.requestTimeout = 10 * 60 * 1000;
  server.headersTimeout = 65 * 1000;

  server.listen(env.PORT, () => {
    console.log(`Meeting AI backend listening on port ${env.PORT}`);
  });
}

export default app;
