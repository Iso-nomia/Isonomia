const mockPrisma: any = {
  conversation: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  conversationParticipant: {
    createMany: jest.fn(),
  },
  $transaction: jest.fn(async (fn: any) => fn(mockPrisma)),
};

jest.mock("@/lib/prismaclient", () => ({ prisma: mockPrisma }));

const {
  createGroupConversation,
  fetchConversation,
  fetchConversations,
  getOrCreateDM,
} = require("@/lib/actions/conversation.actions");

describe("conversation actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getOrCreateDM returns existing conversation", async () => {
    const existing = { id: 1n };
    mockPrisma.conversation.findFirst.mockResolvedValue(existing);
    const convo = await getOrCreateDM({ userAId: 1n, userBId: 2n });
    expect(convo).toBe(existing);
    expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
  });

  test("getOrCreateDM creates conversation when none exists", async () => {
    mockPrisma.conversation.findFirst.mockResolvedValue(null);
    const created = { id: 3n };
    mockPrisma.conversation.create.mockResolvedValue(created);
    const convo = await getOrCreateDM({ userAId: 1n, userBId: 2n });
    expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
      data: { user1_id: 1n, user2_id: 2n },
    });
    expect(mockPrisma.conversationParticipant.createMany).toHaveBeenCalledWith({
      data: [
        { conversation_id: created.id, user_id: 1n },
        { conversation_id: created.id, user_id: 2n },
      ],
    });
    expect(convo).toBe(created);
  });

  test("createGroupConversation requires minimum participants", async () => {
    await expect(createGroupConversation(1n, [2n])).rejects.toThrow(
      "Minimum 3 participants required"
    );
  });

  test("createGroupConversation creates conversation and participants", async () => {
    const created = { id: 5n };
    mockPrisma.conversation.create.mockResolvedValue(created);
    const convo = await createGroupConversation(1n, [2n, 3n], "Group");
    expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
      data: { title: "Group", is_group: true },
    });
    expect(mockPrisma.conversationParticipant.createMany).toHaveBeenCalledWith({
      data: [
        { conversation_id: created.id, user_id: 1n },
        { conversation_id: created.id, user_id: 2n },
        { conversation_id: created.id, user_id: 3n },
      ],
    });
    expect(convo).toBe(created);
  });

  test("fetchConversations returns list", async () => {
    const list = [{ id: 1n }];
    mockPrisma.conversation.findMany.mockResolvedValue(list);
    const result = await fetchConversations(1n);
    expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
      where: { participants: { some: { user_id: 1n } } },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { created_at: "desc" }, take: 1 },
      },
      orderBy: { updated_at: "desc" },
    });
    expect(result).toBe(list);
  });

  test("fetchConversation throws when missing", async () => {
    mockPrisma.conversation.findFirst.mockResolvedValue(null);
    await expect(fetchConversation(1n, 2n)).rejects.toThrow(
      "Conversation not found"
    );
  });

  test("fetchConversation returns conversation", async () => {
    const convo = { id: 1n };
    mockPrisma.conversation.findFirst.mockResolvedValue(convo);
    const result = await fetchConversation(1n, 2n);
    expect(result).toBe(convo);
  });
});
