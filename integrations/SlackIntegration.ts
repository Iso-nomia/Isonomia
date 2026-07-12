import { IntegrationApp } from "@/lib/integrations/types";
import { sendSlackMessage } from "@/lib/actions/slack.actions";

export const integration: IntegrationApp = {
  name: "slack",
  description: "Post messages to Slack channels using a webhook",
  actions: [
    {
      name: "sendMessage",
      run: async (
        params: any,
        creds: Record<string, any>
      ) => {
        await sendSlackMessage({
          webhookUrl: creds.webhookUrl,
          text: params.text,
        });
      },
    },
  ],
};

export default integration;
