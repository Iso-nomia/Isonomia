"use server";

export async function sendSlackMessage({
  webhookUrl,
  text,
}: {
  webhookUrl: string;
  text: string;
}) {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}
