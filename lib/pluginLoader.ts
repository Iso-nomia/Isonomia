export interface PluginDescriptor {
  type: string;
  component: unknown;
  config: Record<string, unknown>;
}

export function loadPlugins(modules: Record<string, { descriptor?: PluginDescriptor }>): PluginDescriptor[] {
  return Object.values(modules)
    .filter((m) => m && m.descriptor)
    .map((m) => m.descriptor!) as PluginDescriptor[];
}

export async function loadPluginsAsync(
  importers: Record<string, () => Promise<{ descriptor?: PluginDescriptor }>>
): Promise<PluginDescriptor[]> {
  const modules = await Promise.all(Object.values(importers).map((fn) => fn()));
  return modules
    .filter((m) => m && m.descriptor)
    .map((m) => m.descriptor!) as PluginDescriptor[];
}
