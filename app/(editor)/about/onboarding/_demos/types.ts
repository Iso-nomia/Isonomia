// app/(editor)/about/onboarding/_demos/types.ts

export interface Message {
  id: string
  text: string | null
  createdAt: string
  senderId: string
  conversationId: string
  sender?: {
    name: string
    image: string | null
  }
  isCurrentUser?: boolean
}

export interface ForumComment {
  id: string
  discussionId: string
  parentId: string | null
  authorId: string
  body: any
  bodyText: string
  score: number
  createdAt: string
  author?: {
    id: string
    name: string
    username: string
    image: string | null
  }
  _children?: ForumComment[]
}

export interface Discussion {
  id: string
  title: string
  description: string | null
  createdById: string
  conversationId: string | null
  deliberations: any[]
  replyCount?: number
}

export interface Participant {
  id: string
  name: string
  username: string
  image: string | null
}

export interface DiscussionData {
  discussion: Discussion
  messages: Message[]
  forumComments: ForumComment[]
  participants: Participant[]
  conversationId: string
  currentUserId: string
}