import { NestedTabs } from "@/components/deepdive/shared/NestedTabs";
import { List, Network, GitFork, Shield, FileText } from "lucide-react";

export default function NestedTabsTestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">NestedTabs Component Test</h1>
          <p className="text-slate-600">
            Testing the new NestedTabs component with primary and secondary variants
          </p>
        </div>

        {/* Primary Variant Test */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">
            Primary Variant (Parent Tabs)
          </h2>
          <NestedTabs
            id="test-primary-tabs"
            defaultValue="tab1"
            variant="primary"
            tabs={[
              {
                value: "tab1",
                label: "Overview",
                icon: <FileText className="size-4" />,
                content: (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900">Overview Content</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      This is the primary variant, used for top-level navigation.
                    </p>
                  </div>
                ),
              },
              {
                value: "tab2",
                label: "Details",
                icon: <List className="size-4" />,
                badge: 5,
                content: (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900">Details Content</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Notice the badge showing "5" on the tab trigger.
                    </p>
                  </div>
                ),
              },
              {
                value: "tab3",
                label: "Settings",
                icon: <Shield className="size-4" />,
                content: (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900">Settings Content</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Tab state persists to localStorage with key "test-primary-tabs".
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </section>

        {/* Secondary Variant Test */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">
            Secondary Variant (Nested Tabs)
          </h2>
          <NestedTabs
            id="test-secondary-tabs"
            defaultValue="list"
            variant="secondary"
            tabs={[
              {
                value: "list",
                label: "All Arguments",
                icon: <List className="size-3.5" />,
                content: (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900">Arguments List</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      This is the secondary variant with smaller, subtler styling.
                      Notice the underline indicator instead of background fill.
                    </p>
                  </div>
                ),
              },
              {
                value: "schemes",
                label: "Schemes",
                icon: <Network className="size-3.5" />,
                badge: 3,
                content: (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900">Detected Schemes</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Badge shows "3" schemes detected. This will integrate Phase 1 features.
                    </p>
                  </div>
                ),
              },
              {
                value: "networks",
                label: "Networks",
                icon: <GitFork className="size-3.5" />,
                badge: 2,
                content: (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900">Argument Networks</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Badge shows "2" networks detected. This will integrate Phase 4 features.
                    </p>
                  </div>
                ),
              },
              {
                value: "aspic",
                label: "ASPIC",
                icon: <Shield className="size-3.5" />,
                content: (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900">ASPIC Analysis</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      This will contain the migrated ASPIC tab content with its own nested structure.
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </section>

        {/* Nested within Nested Test */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">
            Deeply Nested Example (ASPIC with sub-tabs)
          </h2>
          <NestedTabs
            id="test-nested-parent"
            defaultValue="aspic"
            variant="secondary"
            tabs={[
              {
                value: "list",
                label: "List",
                content: <div className="p-4 text-sm text-slate-600">List view</div>,
              },
              {
                value: "aspic",
                label: "ASPIC",
                icon: <Shield className="size-3.5" />,
                content: (
                  <div className="ml-4 mt-2">
                    <NestedTabs
                      id="test-aspic-subtabs"
                      defaultValue="graph"
                      variant="secondary"
                      tabs={[
                        {
                          value: "graph",
                          label: "Graph",
                          content: (
                            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                              <p className="text-sm text-indigo-900">
                                ASPIC Graph view (deeply nested)
                              </p>
                            </div>
                          ),
                        },
                        {
                          value: "extension",
                          label: "Extension",
                          content: (
                            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                              <p className="text-sm text-indigo-900">
                                Extension sets view
                              </p>
                            </div>
                          ),
                        },
                        {
                          value: "rationality",
                          label: "Rationality",
                          content: (
                            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                              <p className="text-sm text-indigo-900">
                                Rationality analysis
                              </p>
                            </div>
                          ),
                        },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
          />
        </section>

        {/* Features Summary */}
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="mb-3 text-lg font-semibold text-emerald-900">✅ Component Features</h2>
          <ul className="space-y-2 text-sm text-emerald-800">
            <li>✓ Primary variant: Full styling for parent tabs (rounded pill shape)</li>
            <li>✓ Secondary variant: Subtle styling for nested tabs (underline indicator)</li>
            <li>✓ localStorage persistence: Tab state survives page refreshes</li>
            <li>✓ Icon support: Optional icons next to labels</li>
            <li>✓ Badge support: Show counts/notifications on tabs</li>
            <li>✓ Keyboard navigation: Built-in Radix UI keyboard support</li>
            <li>✓ Dark mode: Proper color variants for dark theme</li>
            <li>✓ TypeScript: Full type safety with exported interfaces</li>
            <li>✓ Accessible: ARIA attributes from Radix UI primitives</li>
          </ul>
        </section>

        {/* Next Steps */}
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
          <h2 className="mb-3 text-lg font-semibold text-indigo-900">📋 Next Steps</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-indigo-800">
            <li>Extract ArgumentsTab component</li>
            <li>Create SchemesSection (Phase 1 integration)</li>
            <li>Create NetworksSection (Phase 4 integration)</li>
            <li>Migrate ASPIC content to nested structure</li>
            <li>Integrate into DeepDivePanelV2</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
