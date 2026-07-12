import type { NextApiResponse } from "next";
import { initIO } from "@/lib/socket";
import type { Server as IOServer } from "socket.io";

export const config = {
  api: {
    bodyParser: false,
  },
};

type NextApiResponseServerIO = NextApiResponse & {
  socket: NextApiResponse["socket"] & {
    server: {
      io?: IOServer;
    };
  };
};

export default function handler(_req: unknown, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    const io = initIO(res.socket.server);
    res.socket.server.io = io;
    io.on("connection", (socket) => {
      const room = socket.handshake.query.room as string | undefined;
      if (room) socket.join(room);
    });
  }
  res.end();
}
