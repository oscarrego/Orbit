import { io } from "socket.io-client";

const socket = io("https://orbit-g4ah.onrender.com", {
  transports: ["websocket"],
});

export default socket;