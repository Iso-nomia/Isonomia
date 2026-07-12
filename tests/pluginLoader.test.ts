import {
  loadPlugins,
  loadPluginsAsync,
  PluginDescriptor,
} from "@/lib/pluginLoader";

test("loadPlugins collects descriptors", () => {
  const modules = {
    one: { descriptor: { type: "A", component: {}, config: {} } as PluginDescriptor },
    two: {},
    three: { descriptor: { type: "B", component: {}, config: { key: 1 } } as PluginDescriptor },
  };
  const result = loadPlugins(modules);
  expect(result).toHaveLength(2);
  expect(result[0].type).toBe("A");
  expect(result[1].type).toBe("B");
});

test("loadPluginsAsync resolves descriptors", async () => {
  const modules = {
    a: async () => ({ descriptor: { type: "X", component: {}, config: {} } as PluginDescriptor }),
    b: async () => ({}),
    c: async () => ({ descriptor: { type: "Y", component: {}, config: {} } as PluginDescriptor }),
  };
  const result = await loadPluginsAsync(modules);
  expect(result).toHaveLength(2);
  expect(result[0].type).toBe("X");
  expect(result[1].type).toBe("Y");
});
