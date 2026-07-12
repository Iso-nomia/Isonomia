"use client";

import CreateFeedPost from "./CreateFeedPost";

interface Props {
  roomId: string;
}

export default function CreateLoungePost({ roomId }: Props) {
  return <CreateFeedPost roomId={roomId} />;
}
