import { google } from "googleapis";

async function fetchAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set");
    process.exit(1);
  }

  const client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost"
  );

  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error("GOOGLE_REFRESH_TOKEN is not set");
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
