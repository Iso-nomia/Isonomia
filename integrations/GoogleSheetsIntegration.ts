import { IntegrationApp } from "@/lib/integrations/types";
import {
  appendRow,
  createSpreadsheet,
  readRange,
} from "@/lib/actions/googleSheets.actions";

export const integration: IntegrationApp = {
  name: "googleSheets",
  description: "Interact with Google Sheets to store and retrieve data",
  actions: [
    {
      name: "appendRow",
      run: async (params: any, creds: Record<string, any>) => {
        const { spreadsheetId, range, values } = params as {
          spreadsheetId: string;
          range: string;
          values: (string | number)[];
        };
        await appendRow({
          spreadsheetId,
          range,
          values,
          accessToken: creds.accessToken,
        });
      },
    },
    {
      name: "createSpreadsheet",
      run: async (params: any, creds: Record<string, any>) => {
        const { title } = params as { title: string };
        return await createSpreadsheet({ title, accessToken: creds.accessToken });
      },
    },
    {
      name: "readRange",
      run: async (params: any, creds: Record<string, any>) => {
        const { spreadsheetId, range } = params as {
          spreadsheetId: string;
          range: string;
        };
        return await readRange({
          spreadsheetId,
          range,
          accessToken: creds.accessToken,
        });
      },
    },
  ],
};

export default integration;
