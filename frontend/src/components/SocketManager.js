import { io } from "socket.io-client";

const socket = io("https://orbit-g4ah.onrender.com", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  timeout: 10000,
});

export default socket;