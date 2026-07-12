// app/api/onboarding/discussion/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prismaclient'

export const dynamic = 'force-dynamic'

function serializeComment(row: any): any {
  return {
    id: row.id.toString(),
    discussionId: row.discussionId,
    parentId: row.parentId ? row.parentId.toString() : null,
    authorId: row.authorId,
    body: row.body,
    bodyText: row.bodyText,
    score: row.score ?? 0,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    author: row.author ? {
      id: row.author.id.toString(),
      name: row.author.name,
      username: row.author.username,
      image: row.author.image
    } : undefined,
    _children: []
  }
}

export async function GET() {
  try {
    const discussion = await prisma.discussion.findFirst({
      where: {
        title: 'Ranked-Choice Voting Analysis'
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
                    image: true
                  }
                }
              },
              orderBy: { created_at: 'asc' }
            },
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                    image: true
                  }
                }
              }
            }
          }
        },
        deliberations: true
      }
    })

    if (!discussion || !discussion.conversation) {
      return NextResponse.json({ error: 'No seeded data found' }, { status: 404 })
    }

    // Fetch forum comments
    const forumComments = await prisma.forumComment.findMany({
      where: {
        discussionId: discussion.id
      },
      orderBy: { createdAt: 'asc' }
    })

    // Fetch all unique authors
    const authorIds = [...new Set(forumComments.map(c => c.authorId))]
    const authors = await prisma.user.findMany({
      where: {
        id: { in: authorIds.map(id => BigInt(id)) }
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true
      }
    })

    // Create author lookup map
    const authorMap = new Map(authors.map(a => [a.id.toString(), a]))

    // Build comment tree
    const commentMap = new Map<string, any>()
    const topLevelComments: any[] = []

    // First pass: create all comment objects with _children array
    for (const comment of forumComments) {
      const author = authorMap.get(comment.authorId)
      const commentWithAuthor = { ...comment, author }
      const serialized = serializeComment(commentWithAuthor)
      serialized._children = []
      commentMap.set(serialized.id, serialized)
    }

    // Second pass: build tree structure
    for (const comment of commentMap.values()) {
      if (comment.parentId && commentMap.has(comment.parentId)) {
        const parent = commentMap.get(comment.parentId)
        parent._children.push(comment)
      } else {
        topLevelComments.push(comment)
      }
    }

    // Sort top-level by score (descending) - popular comments first
    topLevelComments.sort((a, b) => (b.score || 0) - (a.score || 0))

    // Get current user ID (first user is the demo "current user")
    const currentUserId = discussion.conversation.participants[0]?.user_id.toString()

    // Transform data
    const data = {
      discussion: {
        id: discussion.id,
        title: discussion.title,
        description: discussion.description,
        createdById: discussion.createdById.toString(),
        conversationId: discussion.conversationId?.toString() || null,
        deliberations: discussion.deliberations || [],
        replyCount: forumComments.length
      },
      messages: discussion.conversation.messages.map(msg => ({
        id: msg.id.toString(),
        text: msg.text,
        createdAt: msg.created_at.toISOString(),
        senderId: msg.sender_id.toString(),
        conversationId: msg.conversation_id?.toString() || '',
        sender: msg.sender ? {
          name: msg.sender.name,
          image: msg.sender.image
        } : undefined,
        isCurrentUser: msg.sender_id.toString() === currentUserId
      })),
      forumComments: topLevelComments,
      participants: discussion.conversation.participants.map(p => ({
        id: p.user.id.toString(),
        name: p.user.name,
        username: p.user.username || `user-${p.user.id}`,
        image: p.user.image
      })),
      conversationId: discussion.conversationId?.toString() || '',
      currentUserId: currentUserId
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch discussion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}