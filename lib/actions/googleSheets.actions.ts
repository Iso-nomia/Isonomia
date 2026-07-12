"use server";

import { google } from "googleapis";

function getClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

export async function appendRow({
  spreadsheetId,
  range,
  values,
  accessToken,
}: {
  spreadsheetId: string;
  range: string;
  values: (string | number)[];
  accessToken: string;
}) {
  const sheets = getClient(accessToken);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values],
    },
  });
}

export async function createSpreadsheet({
  title,
  accessToken,
}: {
  title: string;
  accessToken: string;
}) {
  const sheets = getClient(accessToken);
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
    },
  });
  return res.data.spreadsheetId;
}

export async function readRange({
  spreadsheetId,
  range,
  accessToken,
}: {
  spreadsheetId: string;
  range: string;
  accessToken: string;
}) {
  const sheets = getClient(accessToken);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return res.data.values as (string | number)[][] | undefined;
}
