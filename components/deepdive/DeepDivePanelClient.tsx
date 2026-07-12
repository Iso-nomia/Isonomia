//This is a legacy, obselete file kept for reference. Please do not edit or use this file.

"use client";
import { useEffect, useState } from "react";
import DeliberationComposer from "./DeliberationComposer";
import { RepresentativeViewpoints } from "./RepresentativeViewpoints";
import ArgumentsList from "./ArgumentsList";
import { SectionCard } from "./shared/SectionCard";
import CardComposerTab from "@/components/deepdive/CardComposerTab";
import StatusChip from "@/components/governance/StatusChip";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "../ui/tabs";
import CegMiniMap from "./CegMiniMap";
import TopologyWidget from "./TopologyWidget";
import HelpModal from "@/components/help/HelpModal";
import DiscusHelpPage from "../help/HelpPage";
import ApprovalsHeatStrip from "@/components/deepdive/ApprovalsHeatStrip";
import CardList from "@/components/deepdive/CardList";
import { ViewControls } from "./RepresentativeViewpoints";
import GraphPanel from "@/components/graph/GraphPanel";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import CardListVirtuoso from "@/components/deepdive/CardListVirtuoso";
import dynamic from "next/dynamic";

export default function DeepDivePanelClient({
  deliberationId,
  authorId, // <- injected as string | undefined
}: {
  deliberationId: string;
  authorId?: string;
}) {
  /* paste your current DeepDivePanel body here, unchanged except: */

  /* When rendering cards, pass the authorId directly */
  // Example place to swap:
  // <CardList deliberationId={deliberationId} />
  // -> try the paginated version with filters:
  // since: ISO string; change/remove as needed
  const sinceISO = '2025-08-01T00:00:00Z';

  return (
    <div className="space-y-5 p-3">
      {/* ... your existing sections ... */}

      {/* View Cards */}
      <SectionCard title="View Cards">
        <CardListVirtuoso
          deliberationId={deliberationId}
          filters={{
            status: 'published',
            authorId,            // ✅ already a string | undefined
            since: sinceISO,
            sort: 'createdAt:desc',
          }}
        />
      </SectionCard>

      {/* ... rest unchanged ... */}
    </div>
  );
}
