"use server";

export async function fetchLatestIssue({
  repo,
  token,
}: {
  repo: string;
  token?: string;
}) {
  const url = `https://api.github.com/repos/${repo}/issues?per_page=1&state=open&sort=created&direction=desc`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch issues");
  const data = await res.json();
  const issue = data[0];
  return `Latest issue: #${issue.number} ${issue.title}`;
}
