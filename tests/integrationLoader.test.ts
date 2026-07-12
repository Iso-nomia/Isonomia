import { loadIntegrations } from "@/lib/integrationLoader";
import { IntegrationApp } from "@/lib/integrations/types";

test("loadIntegrations collects definitions", () => {
  const modules = {
    one: { integration: { name: "slack" } as IntegrationApp },
    two: {},
    three: { integration: { name: "github" } as IntegrationApp },
  };
  const result = loadIntegrations(modules);
  expect(result).toHaveLength(2);
  expect(result[0].name).toBe("slack");
  expect(result[1].name).toBe("github");
});
