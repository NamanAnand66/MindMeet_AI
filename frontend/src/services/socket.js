import { io } from "socket.io-client";

const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();
const socketUrl = configuredSocketUrl || (import.meta.env.DEV ? "http://localhost:8080" : window.location.origin);

export const createMeetingSocket = () =>
  io(socketUrl, {
    transports: ["websocket"],
    autoConnect: false
  });
