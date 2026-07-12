import analyticsIntegration from "./AnalyticsIntegration";
import gmailIntegration from "./GmailIntegration";
import googleSheetsIntegration from "./GoogleSheetsIntegration";
import slackIntegration from "./SlackIntegration";

export const modules = {
  "./AnalyticsIntegration.ts": { integration: analyticsIntegration },
  "./GmailIntegration.ts": { integration: gmailIntegration },
  "./GoogleSheetsIntegration.ts": { integration: googleSheetsIntegration },
  "./SlackIntegration.ts": { integration: slackIntegration },
};

export default modules;
