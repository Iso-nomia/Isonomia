export function messagePermalink(conversationId: string, messageId: string) {
    return `/messages/${conversationId}?mid=${encodeURIComponent(messageId)}`;
  }