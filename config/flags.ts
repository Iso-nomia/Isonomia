export const flags = {
    roomShards: process.env.ROOM_SHARDS_ENABLED === "true",
    roomExport: process.env.ROOM_EXPORT_ENABLED === "true",
    meshLiteLink: process.env.MESH_LITE_LINK || "https://mesh-lite.example"
  };