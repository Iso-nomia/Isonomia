export interface Anchor {
  startPath: number[]
  startOffset: number
  endPath: number[]
  endOffset: number
}

export interface Comment {
  id: string
  threadId: string
  body: string
  createdBy: string
  createdAt: string
  upvotes: number
  downvotes: number
}

export interface CommentThread {
  id: string
  articleId: string
  anchor: Anchor
  resolved: boolean
  createdBy: string
  createdAt: string
  comments: Comment[]
}
