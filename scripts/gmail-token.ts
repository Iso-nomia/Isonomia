import { google } from "googleapis";

async function fetchAccessToken() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET is not set");
    process.exit(1);
  }

  const client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GMAIL_REDIRECT_URI ?? "http://localhost"
  );

  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error("GMAIL_REFRESH_TOKEN is not set");
    process.exit(1);
  }

  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) {
    console.error("Failed to retrieve access token");
    process.exit(1);
  }

  console.log(token);
}

fetchAccessToken();
