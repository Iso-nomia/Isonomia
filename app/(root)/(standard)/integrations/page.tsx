import IntegrationForm from "./integration-form";
import { fetchIntegrations } from "@/lib/actions/integration.actions";

export default async function Page() {
  const integrations = await fetchIntegrations();
  return (
    <main className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Integrations</h1>
      <IntegrationForm />
      <ul className="space-y-2">
        {integrations.map((i) => (
          <li key={i.id} className="border p-2 rounded">
            {i.service}: {i.credential}
          </li>
        ))}
      </ul>
    </main>
  );
}
