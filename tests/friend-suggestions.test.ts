import { updateUserEmbedding, generateFriendSuggestions } from "@/lib/actions/friend-suggestions.actions";
import { deepseekEmbedding } from "@/lib/deepseekclient";
import { getPineconeIndex } from "@/lib/pineconeClient";
jest.mock("@pinecone-database/pinecone-client-node");

var mockPrisma: any;

jest.mock("@/lib/deepseekclient", () => ({
  deepseekEmbedding: jest.fn(async () => [1, 2, 3]),
}));

var mockIndex: any;
jest.mock("@/lib/pineconeClient", () => ({
  getPineconeIndex: jest.fn(async () => mockIndex),
}));

jest.mock("@/lib/prismaclient", () => {
  mockPrisma = {
    $connect: jest.fn(),
    $transaction: jest.fn(async (ops:any[]) => { for (const op of ops) await op; }),
    userAttributes: { findUnique: jest.fn(), findMany: jest.fn() },
    userEmbedding: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    like: { findMany: jest.fn() },
    userRealtimeRoom: { findMany: jest.fn() },
    friendSuggestion: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
    },
  };
  return { prisma: mockPrisma };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIndex = { query: jest.fn().mockResolvedValue({ matches: [ { id: "2" }, { id: "3" } ] }), upsert: jest.fn() };
  mockPrisma.userAttributes.findMany.mockResolvedValue([]);
});

describe("updateUserEmbedding", () => {
  it("writes embedding to database and pinecone", async () => {
    mockPrisma.userAttributes.findUnique.mockResolvedValue({
      interests: ["coding"],
      hobbies: [],
      artists: [],
      albums: [],
      movies: [],
      books: [],
      communities: [],
    });

    mockIndex = { upsert: jest.fn() };

    const id = BigInt(1);
    await updateUserEmbedding(id);

    expect(mockPrisma.userEmbedding.upsert).toHaveBeenCalledWith({
      where: { user_id: id },
      update: { embedding: [1, 2, 3] },
      create: { user_id: id, embedding: [1, 2, 3] },
    });
    expect(mockIndex.upsert).toHaveBeenCalledWith({
      vectors: [{ id: id.toString(), values: [1, 2, 3] }],
    });
  });
});

describe("generateFriendSuggestions", () => {
  it("includes likes and rooms in scoring", async () => {
    mockPrisma.userEmbedding.findUnique.mockResolvedValue({
      user_id: BigInt(1),
      embedding: [1, 0, 0],
    });
    mockPrisma.userEmbedding.findMany.mockResolvedValue([
      { user_id: BigInt(2), embedding: [0, 1, 0] },
      { user_id: BigInt(3), embedding: [1, 0, 0] },
    ]);

    mockPrisma.like.findMany
      .mockResolvedValueOnce([{ post_id: BigInt(10) }])
      .mockResolvedValueOnce([
        { user_id: BigInt(2), post_id: BigInt(10) },
        { user_id: BigInt(3), post_id: BigInt(11) },
      ]);
    mockPrisma.userRealtimeRoom.findMany
      .mockResolvedValueOnce([{ realtime_room_id: "roomA" }])
      .mockResolvedValueOnce([
        { user_id: BigInt(2), realtime_room_id: "roomA" },
        { user_id: BigInt(3), realtime_room_id: "roomB" },
      ]);
    (Math.random as any) = () => 0.4;

    const result = await generateFriendSuggestions(BigInt(1));

    expect(result.map((r) => r.id)).toEqual([BigInt(2), BigInt(3)]);
    expect(mockPrisma.friendSuggestion.create).toHaveBeenNthCalledWith(1, {
      data: { user_id: BigInt(1), suggested_user_id: BigInt(2), score: 2 },
    });
    expect(mockPrisma.friendSuggestion.create).toHaveBeenNthCalledWith(2, {
      data: { user_id: BigInt(1), suggested_user_id: BigInt(3), score: 1 },
    });
  });
});
