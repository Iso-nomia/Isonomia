/**
 * Test script to verify the discussion API returns correct data
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testAPI() {
  console.log("Testing Discussion API data...\n");

  // Simulate what the API does
  const discussion = await prisma.discussion.findFirst({
    where: {
      title: "Ranked-Choice Voting Analysis",
    },
    include: {
      conversation: {
        include: {
          messages: {
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  image: true,
                },
              },
            },
            orderBy: { created_at: "asc" },
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  image: true,
                },
              },
            },
          },
        },
      },
      deliberations: true,
    },
  });

  if (!discussion || !discussion.conversation) {
    console.error("❌ No discussion or conversation found!");
    process.exit(1);
  }

  // Fetch forum comments
  const forumComments = await prisma.forumComment.findMany({
    where: {
      discussionId: discussion.id,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("✅ Discussion found:", discussion.title);
  console.log("   ID:", discussion.id);
  console.log("   Conversation ID:", discussion.conversationId?.toString());
  console.log("");

  console.log("📧 Messages:", discussion.conversation.messages.length);
  if (discussion.conversation.messages.length > 0) {
    console.log("   First message:", discussion.conversation.messages[0].text.substring(0, 60) + "...");
    console.log("   Last message:", discussion.conversation.messages[discussion.conversation.messages.length - 1].text.substring(0, 60) + "...");
  } else {
    console.log("   ⚠️ No messages found!");
  }
  console.log("");

  console.log("💬 Forum Comments:", forumComments.length);
  if (forumComments.length > 0) {
    const topLevel = forumComments.filter(c => !c.parentId);
    const replies = forumComments.filter(c => c.parentId);
    console.log("   Top-level:", topLevel.length);
    console.log("   Replies:", replies.length);
  } else {
    console.log("   ⚠️ No forum comments found!");
  }
  console.log("");

  console.log("👥 Participants:", discussion.conversation.participants.length);
  discussion.conversation.participants.forEach(p => {
    console.log(`   - ${p.user.name} (@${p.user.username})`);
  });

  console.log("\n✅ API data looks good!");
  
  await prisma.$disconnect();
}

testAPI().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
