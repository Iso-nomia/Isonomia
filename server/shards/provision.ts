// Stub: shard provisioning (server-side infra, not yet implemented in this deployment)
export async function provisionShard(_roomId: string, _region: string): Promise<{ shardUrl: string; mediaBucket: string }> {
  throw new Error("provisionShard: not implemented in this deployment");
}
