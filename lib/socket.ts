import { Server as IOServer } from "socket.io";

let io: IOServer | null = null;

export function initIO(server: any) {
  if (!io) {
    io = new IOServer(server);
  }
  return io;
}

export function getIO() {
  return io;
}
