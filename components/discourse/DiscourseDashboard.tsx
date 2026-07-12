// components/discourse/DiscourseDashboard.tsx
"use client";

import * as React from "react";
import { FileText, MessageSquare, Target, TrendingUp } from "lucide-react";

// Import shared UI components
import { TabButton } from "./shared/TabButton";

// Import panel components
import {
  MyContributionsPanel,
  MyEngagementsPanel,
  ActionsOnMyWorkPanel,
  ActivityFeedPanel,
} from "./panels";

interface DiscourseDashboardProps {
  deliberationId: string;
  userId: string;
}

type DashboardTab = "contributions" | "engagements" | "actions-on-me" | "activity";

const TABS: { id: DashboardTab; label: string; icon: typeof FileText }[] = [
  { id: "contributions", label: "My Contributions", icon: FileText },
  { id: "engagements", label: "My Engagements", icon: MessageSquare },
  { id: "actions-on-me", label: "Actions on My Work", icon: Target },
  { id: "activity", label: "Activity Feed", icon: TrendingUp },
];

/**
 * DiscourseDashboard
 * 
 * Comprehensive dashboard for tracking user participation in deliberations.
 * Shows contributions, engagements, and actions taken on user's work.
 * 
 * Two-tier tab structure:
 * - Top level: My Contributions, My Engagements, Actions on My Work, Activity Feed
 * - Sub-tabs within each category for granular filtering
 * 
 * Refactored Architecture (Sprint 2):
 * - Shared components: TabButton, SubTabButton, StatCard, EmptyState, etc.
 * - Panel components: MyContributionsPanel, MyEngagementsPanel, ActionsOnMyWorkPanel, ActivityFeedPanel
 * - Real-time polling enabled on Actions and Activity panels (30s interval)
 * 
 * Accessibility Features (Sprint 3):
 * - ARIA labels and roles for tabs and panels
 * - Keyboard navigation (Arrow keys to switch tabs)
 * - Focus management with visible focus rings
 * - Screen reader announcements for state changes
 */
export function DiscourseDashboard({ deliberationId, userId }: DiscourseDashboardProps) {
  const [activeTab, setActiveTab] = React.useState<DashboardTab>("contributions");

  // Handle keyboard navigation for tabs
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const currentIndex = TABS.findIndex((tab) => tab.id === activeTab);
    
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % TABS.length;
      setActiveTab(TABS[nextIndex].id);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + TABS.length) % TABS.length;
      setActiveTab(TABS[prevIndex].id);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveTab(TABS[0].id);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveTab(TABS[TABS.length - 1].id);
    }
  };

  return (
    <section 
      className="discourse-dashboard space-y-4"
      aria-labelledby="discourse-dashboard-title"
    >
      {/* Header */}
      <header className="flex items-center justify-between">
        <h2 
          id="discourse-dashboard-title" 
          className="text-lg font-semibold text-slate-800"
        >
          Discourse Dashboard
        </h2>
        <p className="text-sm text-slate-500" aria-hidden="true">
          Track your participation and engagements
        </p>
      </header>

      {/* Top-Level Tabs */}
      <nav 
        className="border-b border-slate-200"
        aria-label="Dashboard sections"
      >
        <div 
          className="flex gap-1"
          role="tablist"
          aria-label="Dashboard tabs"
          onKeyDown={handleKeyDown}
        >
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              icon={tab.icon}
              label={tab.label}
              id={`tab-${tab.id}`}
              aria-controls={`panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
            />
          ))}
        </div>
      </nav>

      {/* Tab Content */}
      <div 
        className="mt-4"
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === "contributions" && (
          <MyContributionsPanel deliberationId={deliberationId} userId={userId} />
        )}
        {activeTab === "engagements" && (
          <MyEngagementsPanel deliberationId={deliberationId} userId={userId} />
        )}
        {activeTab === "actions-on-me" && (
          <ActionsOnMyWorkPanel deliberationId={deliberationId} userId={userId} />
        )}
        {activeTab === "activity" && (
          <ActivityFeedPanel deliberationId={deliberationId} userId={userId} />
        )}
      </div>

      {/* Screen reader live region for tab changes */}
      <div 
        className="sr-only" 
        role="status" 
        aria-live="polite"
        aria-atomic="true"
      >
        {`Now viewing ${TABS.find((t) => t.id === activeTab)?.label}`}
      </div>
    </section>
  );
}


