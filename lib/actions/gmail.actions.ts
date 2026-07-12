"use server";

import { google } from "googleapis";

export async function sendEmail({
  from,
  to,
  subject,
  message,
  accessToken,
}: {
  from: string;
  to: string;
  subject: string;
  message: string;
  accessToken: string;
}) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const raw = [
    `From: <${from}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    "",
    message,
  ]
    .join("\n")
    .replace(/\r?\n/g, "\r\n");

  const encodedMessage = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });
}
