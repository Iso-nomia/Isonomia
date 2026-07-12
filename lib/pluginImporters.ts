import { PluginDescriptor } from "./pluginLoader";

const pluginFiles = [
  "CounterNode.tsx",
  "HelloNode.tsx",
  "PdfViewerNode.tsx",
  "SplineViewerNode.tsx",
];

const importers: Record<string, () => Promise<{ descriptor?: PluginDescriptor }>> = {};

pluginFiles.forEach((file) => {
  importers[`../plugins/${file}`] = () => import(`../plugins/${file}`);
});

export default importers;
