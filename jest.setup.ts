// jest.setup.ts
import React from "react";
import "@testing-library/jest-dom";
(require as any).context = jest.fn(() => ({
  keys: () => [],
}));
jest.mock("@/lib/supabaseclient", () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        createSignedUploadUrl: jest.fn(async () => ({ data: "https://example.com/upload" })),
        upload: jest.fn(),
      })),
    },
  },
}));
jest.mock("@supabase/supabase-js", () => ({}));
jest.mock("@xyflow/react", () => {
  const React = require("react");
  return {
    ReactFlow: ({ children }: any) => React.createElement("div", null, children),
    Background: () => React.createElement("div", null, "background"),
    BackgroundVariant: { Dots: "Dots" },
    Controls: () => React.createElement("div", null, "controls"),
    MiniMap: () => React.createElement("div", null, "minimap"),
    addEdge: jest.fn((edge: any, edges: any[]) => edges.concat(edge)),
    useNodesState: (initial: any[]) => React.useState(initial),
    useEdgesState: (initial: any[]) => React.useState(initial),
    useReactFlow: () => ({ screenToFlowPosition: (pos: any) => pos }),
  };
});

jest.mock("nanoid", () => ({ nanoid: () => "id" }));
jest.mock("@/lib/prismaclient", () => ({ prisma: { $connect: jest.fn() } }));
jest.mock("@/lib/limiter", () => ({
  checkNext: jest.fn(() => true),
  check: jest.fn(() => true),
}));

(require as any).context = () => {
  const fn = () => ({});
  fn.keys = () => [] as string[];
  return fn;
};
