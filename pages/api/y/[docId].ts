// pages/api/y/[docId].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { WebSocketServer } from 'ws';
// `setupWSConnection` is published under the `./bin/utils` subpath export,
// which has no bundled type declaration; require it with an explicit signature.
const { setupWSConnection } = require('y-websocket/bin/utils') as {
  setupWSConnection: (conn: any, req: any, opts?: { docName?: string; gc?: boolean }) => void;
};

// Next should not parse the body for websocket upgrades
export const config = { api: { bodyParser: false } };

let wss: WebSocketServer | undefined;
let upgradeHookAttached = false;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Require a websocket upgrade
  if (req.headers.upgrade !== 'websocket') {
    res.status(426).send('Upgrade Required');
    return;
  }

  // Lazily create a shared WSS (one per Next server)
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
  }

  // Attach the single upgrade hook once
  const server: any = (res.socket as any)?.server;
  if (!upgradeHookAttached && server) {
    server.on('upgrade', (request: any, socket: any, head: any) => {
      try {
        const url = new URL(request.url || '/', 'http://localhost');
        // Only handle our route: /api/y/:docId
        const match = url.pathname.match(/^\/api\/y\/([^/]+)$/);
        if (!match) return;

        const docId = match[1];
        wss!.handleUpgrade(request, socket, head, (ws) => {
          // y-websocket will create (or reuse) the document named docId
          setupWSConnection(ws as any, request, { docName: docId });
        });
      } catch {
        // Silently ignore malformed upgrade
        socket?.destroy?.();
      }
    });
    upgradeHookAttached = true;
  }

  // End the HTTP handler; the upgrade listener will take over
  res.end();
}
