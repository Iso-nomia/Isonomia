export async function deleteFeedPost({
  id,
  path,
}: {
  id: bigint;
  path: string;
}) {
  await fetch("/api/feed/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id.toString(), path }),
  });
}

export async function replicateFeedPost(args: {
  originalPostId: string | number | bigint;
  userId: string | number | bigint;
  path: string;
  text?: string;
}) {
  await fetch("/api/feed/replicate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
}
