import { IntegrationApp } from "@/lib/integrations/types";

export function loadIntegrations(
  modules: Record<string, { integration?: IntegrationApp }>
): IntegrationApp[] {
  return Object.values(modules)
    .filter((m) => m && m.integration)
    .map((m) => m.integration!) as IntegrationApp[];
}
