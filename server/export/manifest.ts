// server/export/manifest.ts
export type RoomManifest = {
    version: 1;
    roomId: string;
    region: string;
    schema: string;           // e.g., room_<id>
    mediaBucket: string;
    counts: Record<string, number>; // {"messages": 123, "realtime_posts": 45, ...}
    hashes: {                 // SHA-256 (hex) for db.sql and every media object we include
      dbSql: string;
      media: Record<string, string>; // key -> sha256
    };
    createdAt: string;        // ISO
  };
  
  export function emptyManifest(init: Partial<RoomManifest>): RoomManifest {
    return {
      version: 1,
      roomId: "",
      region: "",
      schema: "",
      mediaBucket: "",
      counts: {},
      hashes: { dbSql: "", media: {} },
      createdAt: new Date().toISOString(),
      ...init,
    };
  }
  