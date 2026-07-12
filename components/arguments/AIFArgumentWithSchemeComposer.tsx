"use client";
import * as React from "react";
import {
  listSchemes,
  createArgument,
  getArgumentCQs,
  askCQ,
} from "@/lib/client/aifApi";
import { ClaimPicker } from "@/components/claims/ClaimPicker";
import dynamic from "next/dynamic";
import { LegalMoveToolbarAIF } from "@/components/dialogue/LegalMoveToolbarAIF";
import { SchemeComposerPicker } from "../SchemeComposerPicker";
import { ClaimConfidence } from "@/components/evidence/ClaimConfidence";
import { createClaim } from "@/lib/client/aifApi";
import { SchemePickerWithHierarchy } from "./SchemePickerWithHierarchy";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PropositionComposerPro } from "@/components/propositions/PropositionComposerPro";
import { Save, Tag, Network, Layers } from "lucide-react";
import CitationCollector, { type PendingCitation } from "@/components/citations/CitationCollector";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EvidenceRequirements, type EvidenceRequirement } from "@/components/argumentation/EvidenceGuidance";
import { ContradictionWarningModal } from "@/components/aif/ContradictionWarningModal";
export type AttackContext =
  | { mode: "REBUTS"; targetClaimId: string; hint?: string }
  | { mode: "UNDERCUTS"; targetArgumentId: string; hint?: string }
  | { mode: "UNDERMINES"; targetPremiseId: string; hint?: string }
  | null;

type Props = {
  deliberationId: string;
  authorId: string;
  conclusionClaim: { id?: string; text?: string } | null; // ⬅️ allow null to “clear”

  defaultSchemeKey?: string | null;
  attackContext?: AttackContext; // ✅ NEW
  onCreated?: (argumentId: string) => void;
  onCreatedDetail?: (arg: {
    id: string;
    conclusion: { id: string; text: string };
    premises: { id: string; text: string }[];
  }) => void;
  onChangeConclusion?: (c: { id?: string; text?: string } | null) => void; // ⬅️ accept null/partial
};

type Prem = { id: string; text: string };
type Scheme = {
  id: string;
  key: string;
  name: string;
  slotHints?: { premises?: { role: string; label: string }[] } | null;
  cqs?: Array<{
    cqKey: string;
    text: string;
    attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
    targetScope: "conclusion" | "inference" | "premise";
  }>;
  formalStructure?: {
    majorPremise?: string;
    minorPremise?: string;
    conclusion?: string;
  } | null;
  materialRelation?: string | null;
  reasoningType?: string | null;
  clusterTag?: string | null;
  semanticCluster?: string | null;
  premises?: Array<{
    id: string;
    type?: string;
    text: string;
    variables?: string[];
  }> | null;
  evidenceRequirements?: EvidenceRequirement[] | null;
};

// Helper to generate basic evidence requirements from scheme metadata
function inferEvidenceRequirements(scheme: Scheme): EvidenceRequirement[] {
  const requirements: EvidenceRequirement[] = [];
  
  // Infer from materialRelation
  if (scheme.materialRelation) {
    if (scheme.materialRelation.includes("authority") || scheme.materialRelation.includes("expert")) {
      requirements.push({
        type: "expert-testimony",
        description: "Testimony from a credible expert in the relevant domain",
        required: true,
        strengthNeeded: 70,
        examples: ["Academic publications", "Expert interviews", "Professional credentials"],
        tips: ["Verify expert credentials", "Check for conflicts of interest", "Look for consensus among experts"]
      });
    }
    if (scheme.materialRelation.includes("cause") || scheme.materialRelation === "causal") {
      requirements.push({
        type: "causal-evidence",
        description: "Evidence showing causal relationship between events",
        required: true,
        strengthNeeded: 65,
        examples: ["Scientific studies", "Controlled experiments", "Time-series data"],
        tips: ["Establish temporal sequence", "Rule out alternative causes", "Look for mechanism explanation"]
      });
    }
    if (scheme.materialRelation.includes("example") || scheme.materialRelation === "analogy") {
      requirements.push({
        type: "example",
        description: "Concrete examples or analogous cases",
        required: false,
        strengthNeeded: 50,
        examples: ["Case studies", "Historical examples", "Similar situations"],
        tips: ["Ensure relevance", "Check for key similarities", "Note important differences"]
      });
    }
  }
  
  // Infer from semanticCluster
  if (scheme.semanticCluster) {
    if (scheme.semanticCluster === "evidence" && requirements.length === 0) {
      requirements.push({
        type: "general-evidence",
        description: "Supporting evidence for your claims",
        required: false,
        strengthNeeded: 60,
        examples: ["Research papers", "Data sources", "Credible reports"],
        tips: ["Use multiple sources", "Check source credibility", "Ensure relevance"]
      });
    }
  }
  
  return requirements;
}

export function AIFArgumentWithSchemeComposer({
  deliberationId,
  authorId,
  conclusionClaim,
  defaultSchemeKey,
  attackContext = null,
  onCreated,
  onCreatedDetail,
  onChangeConclusion,
}: Props) {
  const [schemes, setSchemes] = React.useState<
    Array<{
      id: string;
      key: string;
      name: string;
      slotHints?: any;
      cqs?: any[];
      formalStructure?: {
        majorPremise?: string;
        minorPremise?: string;
        conclusion?: string;
      } | null;
      materialRelation?: string | null;
      reasoningType?: string | null;
      clusterTag?: string | null;
      semanticCluster?: string | null;
      premises?: Array<{
        id: string;
        type?: string;
        text: string;
        variables?: string[];
      }> | null;
    }>
  >([]);
  const [schemeKey, setSchemeKey] = React.useState(defaultSchemeKey ?? "");
  const [premises, setPremises] = React.useState<Prem[]>([]);
  const [implicitWarrantText, setImplicitWarrantText] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [argumentId, setArgumentId] = React.useState<string | null>(null);
  const [cqs, setCqs] = React.useState<
    Array<{
      cqKey: string;
      text: string;
      status: "open" | "answered";
      attackType: string;
      targetScope: string;
    }>
  >([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [pendingCitations, setPendingCitations] = React.useState<PendingCitation[]>([]);
  
  // Contradiction detection state
  const [showContradictionModal, setShowContradictionModal] = React.useState(false);
  const [detectedContradictions, setDetectedContradictions] = React.useState<any[]>([]);
  const [pendingArgumentPayload, setPendingArgumentPayload] = React.useState<any>(null);
  
  // Phase B: Axioms designation - mark all premises as axioms (indisputable)
  const [premisesAreAxioms, setPremisesAreAxioms] = React.useState(false);
  
  // ASPIC+ Phase 1b.3: Rule type designation (strict vs defeasible)
  const [ruleType, setRuleType] = React.useState<'STRICT' | 'DEFEASIBLE'>('DEFEASIBLE');
  const [ruleName, setRuleName] = React.useState("");
  const [showRuleTypeHelp, setShowRuleTypeHelp] = React.useState(false);
  
  // Justification for scheme selection (optional)
  const [schemeJustification, setSchemeJustification] = React.useState("");

  // NEW: drafts for inline creation
  const [conclusionDraft, setConclusionDraft] = React.useState(
    conclusionClaim?.text ?? ""
  );
  React.useEffect(() => {
    setConclusionDraft(conclusionClaim?.text ?? "");
  }, [conclusionClaim?.id, conclusionClaim?.text]);

  const [premDraft, setPremDraft] = React.useState(""); // quick-add premise text
  const [majorPremiseDraft, setMajorPremiseDraft] = React.useState("");
  const [minorPremiseDraft, setMinorPremiseDraft] = React.useState("");
  const [majorPremise, setMajorPremise] = React.useState<Prem | null>(null);
  const [minorPremise, setMinorPremise] = React.useState<Prem | null>(null);
  const [pickerPremOpen, setPickerPremOpen] = React.useState(false);
  const [pickerMajorOpen, setPickerMajorOpen] = React.useState(false);
  const [pickerMinorOpen, setPickerMinorOpen] = React.useState(false);
  const [pickerConcOpen, setPickerConcOpen] = React.useState(false);
  const [editingConclusion, setEditingConclusion] = React.useState(false);
  const [savingConclusion, setSavingConclusion] = React.useState(false);
  const [expandedConclusionEditor, setExpandedConclusionEditor] = React.useState(false);
  const [expandedPremiseEditor, setExpandedPremiseEditor] = React.useState(false);

  async function saveConclusionNow() {
    const draft = (conclusionDraft ?? "").trim();
    if (!draft) return;
    setSavingConclusion(true);
    try {
      const id = await createClaim({ deliberationId, authorId, text: draft });
      setConclusion({ id, text: draft }); // Update both local and parent state
      setEditingConclusion(false);
      window.dispatchEvent(
        new CustomEvent("claims:changed", { detail: { deliberationId } })
      );
    } catch (e: any) {
      setErr(e.message || "Failed to save conclusion");
    } finally {
      setSavingConclusion(false);
    }
  }
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [currentConclusion, setCurrentConclusion] = React.useState<{
    id?: string;
    text?: string;
  } | null>(conclusionClaim ?? null);
  const [justPicked, setJustPicked] = React.useState(false);

  // keep local in sync when parent prop changes
  React.useEffect(() => {
    setCurrentConclusion(conclusionClaim ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conclusionClaim?.id, conclusionClaim?.text]);

  // helper to set both local + parent
  const setConclusion = React.useCallback(
    (c: { id?: string; text?: string } | null) => {
      setCurrentConclusion(c);
      onChangeConclusion?.(c ?? null);
    },
    [onChangeConclusion]
  );

  React.useEffect(() => {
    listSchemes()
      .then(setSchemes)
      .catch(() => setSchemes([]));
  }, []);

  const selected = schemes.find((s) => s.key === schemeKey) || null;
  
  // Debug logging for formal structure
  React.useEffect(() => {
    if (selected) {
      console.log('Selected scheme:', selected.key, selected.name);
      console.log('Has formalStructure:', !!selected.formalStructure);
      console.log('formalStructure data:', selected.formalStructure);
    }
  }, [selected]);
  
  // const hasConclusion = Boolean(conclusionClaim?.id);
  // const canCreate = Boolean(authorId && hasConclusion && premises.length > 0);

  // function removePremise(id: string) { setPremises(ps => ps.filter(p => p.id !== id)); }

  // Check if we have a valid conclusion (either saved ID or draft text that can be saved)
  const hasConclusion =
    Boolean(currentConclusion?.id) ||
    Boolean((conclusionDraft ?? "").trim().length > 0);

  // Check if using structured (major/minor) or freeform premises
  const hasStructuredPremises = Boolean(majorPremise && minorPremise);
  const hasFreeformPremises = premises.length > 0;
  
  // Validation: need author, conclusion, and at least one premise approach
  // const canCreate = Boolean(
  //   authorId && 
  //   hasConclusion && 
  //   (hasStructuredPremises || hasFreeformPremises)
  // );
  const canCreate = true;
  function removePremise(id: string) {
    setPremises((ps) => ps.filter((p) => p.id !== id));
  }

  // NEW: ensure a claim id exists (create if needed)
  async function ensureClaimId(c: {
    id?: string;
    text?: string;
  }): Promise<string> {
    if (c?.id) return c.id;
    const text = (c?.text ?? conclusionDraft ?? "").trim();
    if (!text) throw new Error("Provide text for the conclusion.");
    const id = await createClaim({ deliberationId, authorId, text });
    // inform parent so downstream widgets (Confidence, toolbar) get the id
    onChangeConclusion?.({ id, text });
    return id;
  }

  async function ensureConclusionId(): Promise<string> {
    const draft = (conclusionDraft ?? "").trim();

    // If the user typed something new, mint it
    if (draft && draft !== (currentConclusion?.text ?? "")) {
      const id = await createClaim({ deliberationId, authorId, text: draft });
      setConclusion({ id, text: draft });
      return id;
    }

    if (currentConclusion?.id) return currentConclusion.id;
    if (draft) {
      const id = await createClaim({ deliberationId, authorId, text: draft });
      setConclusion({ id, text: draft });
      return id;
    }
    throw new Error("Provide a conclusion.");
  }
  const hasConclusionId = Boolean(currentConclusion?.id);

  // NEW: quick-add premise by typing
  async function addPremiseFromDraft() {
    const text = premDraft.trim();
    if (!text) return;
    try {
      const id = await createClaim({ deliberationId, authorId, text });
      setPremises((ps) => [...ps, { id, text }]);
      setPremDraft("");
      window.dispatchEvent(
        new CustomEvent("claims:changed", { detail: { deliberationId } })
      );
    } catch (e: any) {
      setErr(e.message || "Failed to create premise");
    }
  }

  // Add major premise
  async function addMajorPremiseFromDraft() {
    const text = majorPremiseDraft.trim();
    if (!text) return;
    try {
      const id = await createClaim({ deliberationId, authorId, text });
      setMajorPremise({ id, text });
      setMajorPremiseDraft("");
      window.dispatchEvent(
        new CustomEvent("claims:changed", { detail: { deliberationId } })
      );
    } catch (e: any) {
      setErr(e.message || "Failed to create major premise");
    }
  }

  // Add minor premise
  async function addMinorPremiseFromDraft() {
    const text = minorPremiseDraft.trim();
    if (!text) return;
    try {
      const id = await createClaim({ deliberationId, authorId, text });
      setMinorPremise({ id, text });
      setMinorPremiseDraft("");
      window.dispatchEvent(
        new CustomEvent("claims:changed", { detail: { deliberationId } })
      );
    } catch (e: any) {
      setErr(e.message || "Failed to create minor premise");
    }
  }

  // small helper to post CA (conflict application)
  async function postCA(body: any, signal?: AbortSignal) {
    const r = await fetch("/api/ca", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.ok === false)
      throw new Error(j?.error || `HTTP ${r.status}`);
  }
  async function handleCreate() {
    if (!canCreate) {
      setErr(
        !hasStructuredPremises && !hasFreeformPremises
          ? "Add at least one premise or both major and minor premises."
          : !hasConclusion
          ? "Provide or pick a conclusion."
          : "User not ready."
      );
      return;
    }
    setErr(null);
    setCreating(true);
    const ctrl = new AbortController();

    try {
      // 1) Ensure conclusion id (create if only text provided)
      const conclusionId = await ensureConclusionId();
      console.log("Conclusion ID ensured:", conclusionId);

      // 2) Build premise list: prioritize structured (major/minor) if present
      let premiseClaimIds: string[];
      if (hasStructuredPremises) {
        // Use major + minor in order
        premiseClaimIds = [majorPremise!.id, minorPremise!.id];
        console.log("Using structured premises:", premiseClaimIds);
      } else {
        // Use freeform premises
        premiseClaimIds = premises.map((p) => p.id);
        console.log("Using freeform premises:", premiseClaimIds);
      }

      // 3) (Optional) build slots from slotHints for server-side validators
      let slots: Record<string, string> | undefined = undefined;
      const roles =
        selected?.slotHints?.premises?.map((p: any) => p.role) ?? [];
      if (roles.length && hasStructuredPremises) {
        // Map major premise to first role, minor to second
        slots = {};
        if (roles[0]) slots[roles[0]] = majorPremise!.id;
        if (roles[1]) slots[roles[1]] = minorPremise!.id;
        if (conclusionId) (slots as any).conclusion = conclusionId;
      } else if (roles.length) {
        slots = {};
        roles.forEach((role: string, i: number) => {
          const pid = premises[i]?.id;
          if (role && pid) slots![role] = pid;
        });
        // also pass conclusion if your validator expects it
        if (conclusionId) (slots as any).conclusion = conclusionId;
      }

      // 3) Create the RA
      const argumentPayload = {
        deliberationId,
        authorId,
        conclusionClaimId: conclusionId,
        premiseClaimIds,
        schemeId: selected?.id ?? null,
        implicitWarrant: implicitWarrantText ? { text: implicitWarrantText } : null,
        // Phase B: Pass axiom designation to API
        premisesAreAxioms,
        // ASPIC+ Phase 1b.3: Pass rule type to API
        ruleType,
        ruleName: ruleName.trim() || undefined,
        // Justification for scheme selection
        justification: schemeJustification || undefined,
        // harmless extra; server will just ignore if not using it yet
        ...(slots ? { slots } : {}),
      };
      
      const id = await createArgument(argumentPayload);
      setArgumentId(id);
      onCreated?.(id);
      
      // Attach citations to the newly created argument
      if (pendingCitations.length > 0) {
        await Promise.all(
          pendingCitations.map(async (citation) => {
            try {
              // First resolve the source
              let resolvePayload: any = {};
              if (citation.type === "url") {
                resolvePayload = { url: citation.value, meta: { title: citation.title } };
              } else if (citation.type === "doi") {
                resolvePayload = { doi: citation.value };
              } else if (citation.type === "library") {
                resolvePayload = { libraryPostId: citation.value, meta: { title: citation.title } };
              }

              const resolveRes = await fetch("/api/citations/resolve", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(resolvePayload),
                signal: ctrl.signal,
              });
              const { source } = await resolveRes.json();
              
              if (!source?.id) throw new Error("Failed to resolve source");

              // Then attach the citation
              await fetch("/api/citations/attach", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  targetType: "argument",
                  targetId: id,
                  sourceId: source.id,
                  locator: citation.locator,
                  quote: citation.quote,
                  note: citation.note,
                }),
                signal: ctrl.signal,
              });
            } catch (citErr) {
              console.error("Failed to attach citation:", citErr);
              // Continue with other citations even if one fails
            }
          })
        );
        // Clear citations after successful attachment
        setPendingCitations([]);
        // Notify listeners that citations changed
        window.dispatchEvent(new CustomEvent("citations:changed", { detail: { targetType: "argument", targetId: id } }));
      }
      
      // Build response for onCreatedDetail
      const responsePremises = hasStructuredPremises
        ? [
            { id: majorPremise!.id, text: majorPremise!.text },
            { id: minorPremise!.id, text: minorPremise!.text },
          ]
        : premises;
        
      onCreatedDetail?.({
        id,
        conclusion: {
          id: conclusionId,
          text: (conclusionClaim?.text ?? conclusionDraft) || conclusionId,
        },
        premises: responsePremises,
      });

      // 4) Attach CA if we launched in “attack” mode (use the *new* argument’s conclusion)
      if (attackContext) {
        if (attackContext.mode === "REBUTS") {
          await postCA(
            {
              deliberationId,
              conflictingClaimId: conclusionId,
              conflictedClaimId: attackContext.targetClaimId,
              legacyAttackType: "REBUTS",
              legacyTargetScope: "conclusion",
            },
            ctrl.signal
          );
        } else if (attackContext.mode === "UNDERCUTS") {
          await postCA(
            {
              deliberationId,
              conflictingClaimId: conclusionId,
              conflictedArgumentId: attackContext.targetArgumentId,
              legacyAttackType: "UNDERCUTS",
              legacyTargetScope: "inference",
            },
            ctrl.signal
          );
        } else if (attackContext.mode === "UNDERMINES") {
          await postCA(
            {
              deliberationId,
              conflictingClaimId: conclusionId,
              conflictedClaimId: attackContext.targetPremiseId,
              legacyAttackType: "UNDERMINES",
              legacyTargetScope: "premise",
            },
            ctrl.signal
          );
        }
      }

      const items = await getArgumentCQs(id);
      setCqs(items || []);
      window.dispatchEvent(
        new CustomEvent("claims:changed", { detail: { deliberationId } })
      );
    } catch (e: any) {
      // Check if this is a contradiction error
      if (e.isContradiction && e.contradictions) {
        // We need to recreate the payload since we can't access variables from try block
        // Re-compute the necessary values
        const conclusionId = await ensureConclusionId().catch(() => null);
        if (!conclusionId) {
          setErr("Failed to ensure conclusion claim");
          setCreating(false);
          return;
        }
        
        let premiseClaimIds: string[];
        if (hasStructuredPremises) {
          premiseClaimIds = [majorPremise!.id, minorPremise!.id];
        } else {
          premiseClaimIds = premises.map((p) => p.id);
        }
        
        let slots: Record<string, string> | undefined = undefined;
        const roles = selected?.slotHints?.premises?.map((p: any) => p.role) ?? [];
        if (roles.length && hasStructuredPremises) {
          slots = {};
          if (roles[0]) slots[roles[0]] = majorPremise!.id;
          if (roles[1]) slots[roles[1]] = minorPremise!.id;
          if (conclusionId) (slots as any).conclusion = conclusionId;
        } else if (roles.length) {
          slots = {};
          roles.forEach((role: string, i: number) => {
            const pid = premises[i]?.id;
            if (role && pid) slots![role] = pid;
          });
          if (conclusionId) (slots as any).conclusion = conclusionId;
        }
        
        // Store the contradiction data and show modal
        setDetectedContradictions(e.contradictions);
        setPendingArgumentPayload({
          deliberationId,
          authorId,
          conclusionClaimId: conclusionId,
          premiseClaimIds,
          schemeId: selected?.id ?? null,
          implicitWarrant: implicitWarrantText ? { text: implicitWarrantText } : null,
          premisesAreAxioms,
          ruleType,
          ruleName: ruleName.trim() || undefined,
          justification: schemeJustification || undefined,
          ...(slots ? { slots } : {}),
        });
        setShowContradictionModal(true);
        setCreating(false);
        return; // Don't show error message, let modal handle it
      }
      setErr(e.message || "create_failed");
    } finally {
      setCreating(false);
      ctrl.abort();
    }
  }

  return (
    <div className="bg-transparent space-y-4 p-2 w-full">
      <div className="text-md font-semibold tracking-wide text-gray-900 ">
        Argument Composer
      </div>

      <div className="rounded-xl panel-edge-sky bg-indigo-50 p-4 ">
        <div className="items-center flex flex-wrap w-full gap-5">
        <div className="flex text-base text-gray-700 ">
          {selected ? (
            <div>
              Using scheme: <span className="font-bold gap-2">{selected.name}</span>
            </div>
          ) : (
            "Freeform argument"
          )}
        </div>
        
        {/* Taxonomy Badges */}
        {selected && (selected.materialRelation || selected.reasoningType || selected.clusterTag || selected.semanticCluster) && (
          <div className="mt-0 flex flex-wrap gap-2">
            {selected.materialRelation && (
              <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-xs">
                <Network className="w-3 h-3 mr-1" />
                {selected.materialRelation}
              </Badge>
            )}
            {selected.reasoningType && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                <Layers className="w-3 h-3 mr-1" />
                {selected.reasoningType}
              </Badge>
            )}
            {selected.semanticCluster && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                <Tag className="w-3 h-3 mr-1" />
                {selected.semanticCluster}
              </Badge>
            )}
            {selected.clusterTag && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                {selected.clusterTag}
              </Badge>
            )}
          </div>
        )}
        </div>
        <hr className="border-slate-500/50 my-2" />

        <div className="flex gap-3 w-full flex-col">
          <label className="flex flex-col gap-1 md:col-span-1">
            <span className="text-sm font-medium text-gray-800">Argument Scheme</span>
            <SchemePickerWithHierarchy
              schemes={schemes}
              selectedKey={schemeKey}
              onSelect={(key) => setSchemeKey(key)}
            />
            {selected?.slotHints?.premises?.length ? (
              <div className="mt-1 flex gap-1 flex-wrap">
                {selected.slotHints.premises.map((p: any) => (
                  <span
                    key={p.role}
                    className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs"
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            ) : null}
          </label>

          {/* Formal Argument Structure - shown when scheme is selected */}
          {selected && selected.formalStructure && (
            <div className="md:col-span-3 mt-2 p-3 rounded-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/50">
              <div className="flex items-start gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-indigo-200">
                  <svg className="w-4 h-4 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                    Formal Structure
                  </h4>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    Follow this logical structure when constructing your argument
                  </p>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                {selected.formalStructure.majorPremise && (
                  <div className="flex gap-2">
                    <span className="text-[11px] font-bold text-indigo-700 min-w-[90px]">Major Premise:</span>
                    <span className="text-[11px] text-slate-700 leading-relaxed">{selected.formalStructure.majorPremise}</span>
                  </div>
                )}
                {selected.formalStructure.minorPremise && (
                  <div className="flex gap-2">
                    <span className="text-[11px] font-bold text-indigo-700 min-w-[90px]">Minor Premise:</span>
                    <span className="text-[11px] text-slate-700 leading-relaxed">{selected.formalStructure.minorPremise}</span>
                  </div>
                )}
                {selected.formalStructure.conclusion && (
                  <div className="flex gap-2">
                    <span className="text-[11px] font-bold text-indigo-700 min-w-[90px]">Conclusion:</span>
                    <span className="text-[11px] text-slate-700 leading-relaxed">{selected.formalStructure.conclusion}</span>
                  </div>
                )}
              </div>
            </div>
          )}
{/* Justification textarea - why this scheme? */}
            {selected && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200">
                <label className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    
                    <span className="text-sm font-semibold text-indigo-900">
                      Justification for Scheme Selection
                    </span>
                  </div>
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Why did you choose this scheme? (optional, but helpful for reviewers)
                  </p>
                  <textarea
                    value={schemeJustification}
                    onChange={(e) => setSchemeJustification(e.target.value)}
                    placeholder="E.g., 'I chose Expert Opinion because the author explicitly cites Dr. Smith's credentials. The major premise comes from paragraph 2, the minor from the conclusion...'"
                    className="w-full min-h-[80px] px-3 py-2 text-sm rounded-lg border border-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                </label>
              </div>
            )}

          {/* ⇩ Conclusion: readable + change/pick control */}
          <label className="flex flex-col gap-1 md:col-span-2 border px-2 py-3 rounded-md border-indigo-400 w-full">
            <span className="text-base font-medium pb-1   tracking-wide text-gray-800">Argument Conclusion</span>
            {/* A) edit mode OR no id → show text input */}
            {editingConclusion || !conclusionClaim?.id ? (
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 min-w-0  rounded-lg px-3 py-2 text-sm bg-white articlesearchfield"
                  placeholder="Type your conclusion…"
                  value={conclusionDraft}
                  onChange={(e) => setConclusionDraft(e.target.value)}
                />
                <button
                  className="text-xs px-2 py-2 rounded-lg border  btnv2--ghost bg-white"
                  onClick={() => setPickerConcOpen(true)}
                >
                  Use existing claim
                </button>
                {editingConclusion && (
                  <button
                    className="text-xs px-2 py-2 rounded-lg border btnv2--ghost bg-slate-50"
                    onClick={() => setEditingConclusion(false)}
                  >
                    Cancel
                  </button>
                )}
                <button
                  className="text-xs px-3 py-2 rounded-xl border btnv2 bg-white"
                  onClick={() => setExpandedConclusionEditor(true)}
                  title="Open rich editor for complex claims"
                >
                  ➾ Expand
                </button>
                
                <button
                  className="text-xs px-3 py-2 rounded-lg btnv2 bg-indigo-600 text-white"
                  disabled={!conclusionDraft.trim() || savingConclusion}
                  onClick={saveConclusionNow}
                  title="Save this text as a new claim"
                >
                  <Save className="inline-block w-3 h-3 gap-1 text-sm" />
                  {savingConclusion ? "Saving…" : "Save"}
                </button>
                
              </div>
            ) : (
              /* B) id present → show read-only row + actions */
               <div className="flex items-center gap-2">
    <div className="flex-1 min-w-0 border border-indigo-800/60 rounded-lg h-full py-1.5 px-2 text-sm bg-white/50 
    flex items-center justify-between shadow-sm shadow-slate-400/30">
      <span className="truncate">
        {currentConclusion ? (currentConclusion.text ?? currentConclusion.id) : ""}
      </span>
      {justPicked && (
        <span className="ml-2 text-[11px] text-emerald-700">
          Saved ✓
        </span>
      )}
    </div>
    <button className="text-xs px-2 py-2 rounded-lg btnv2--ghost bg-white" onClick={() => setPickerConcOpen(true)}>
      Use existing claim
    </button>
    <button
      className="text-xs px-2 py-2 rounded-lg btnv2--ghost bg-white"
      onClick={() => {
        setEditingConclusion(true);
        setConclusionDraft(currentConclusion?.text ?? '');
      }}
    >
      Type new…
    </button>
                <button
                  className="text-xs px-2 py-2 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100"
                  onClick={() => {
                    setConclusion(null); // ← unset locally + parent
                    setEditingConclusion(true);
                    setConclusionDraft("");
                  }}
                >
                  Clear
                </button>
              </div>
            )}
          </label>
        </div>

        <hr className="border-slate-500/50 my-3" />
        
        {/* Conditional rendering: Show structured major/minor inputs when scheme has formalStructure */}
        {selected && selected.formalStructure && selected.formalStructure.majorPremise && selected.formalStructure.minorPremise ? (
          <div className="mt-2 space-y-4">
           
            
            
            <div className="text-sm font-medium text-indigo-900 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              Structured Premises 
            </div>
            
            {/* Major Premise */}
            <div>
              <label className="flex flex-col gap-2 border border-indigo-400 rounded-md px-2 py-3 ">
                <div className="flex items-center gap-5">
                  <span className="text-sm font-medium text-slate-700">P1: Major Premise</span>
                  <button
                    className="text-[11px] px-2 py-1 rounded-lg btnv2--ghost bg-white"
                    onClick={() => setPickerMajorOpen(true)}
                  >
                    Use existing claim
                  </button>
                </div>
                {selected.formalStructure.majorPremise && (
                  <div className="text-[11px] text-indigo-700 italic  px-2 py-1 rounded border w-fit bg-white border-indigo-200">
                    Template: {selected.formalStructure.majorPremise}
                  </div>
                )}
                {/* Variable hints */}
                {selected.premises && selected.premises[0]?.variables && selected.premises[0].variables.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-medium">Variables to include:</span>
                    <div className="flex gap-1 flex-wrap">
                      {selected.premises[0].variables.map((variable: string) => (
                        <code key={variable} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                          {`{${variable}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
                {majorPremise ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 border border-emerald-600/60 rounded-lg py-2 px-3 text-sm bg-emerald-50/50 flex items-center justify-between">
                      <span className="truncate">{majorPremise.text}</span>
                    </div>
                    <button
                      className="text-xs px-2 py-1 rounded-lg border border-rose-200 text-rose-700 bg-rose-50"
                      onClick={() => setMajorPremise(null)}
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg px-3 py-2 text-sm articlesearchfield"
                      placeholder="Enter major premise..."
                      value={majorPremiseDraft}
                      onChange={(e) => setMajorPremiseDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && majorPremiseDraft.trim())
                          addMajorPremiseFromDraft();
                      }}
                    />
                      <button
                className="text-xs px-5 rounded-xl btnv2 bg-white"
                onClick={() => setExpandedPremiseEditor(true)}
                title="Open rich editor for complex premises"
              >
                ➾ Expand
              </button>
                    <button
                      className="text-xs px-4 rounded-xl bg-white btnv2"
                      disabled={!majorPremiseDraft.trim()}
                      onClick={addMajorPremiseFromDraft}
                    >
                      ⊕ Add
                    </button>
                  </div>
                )}
              </label>
            </div>

            {/* Minor Premise */}
            <div>
              <label className="flex flex-col gap-2 border border-indigo-400 rounded-md px-2 py-3 ">
                <div className="flex items-center gap-5">
                  <span className="text-sm font-medium text-slate-700">P2: Minor Premise</span>
                  <button
                    className="text-[11px] px-2 py-1 rounded-lg btnv2--ghost bg-white"
                    onClick={() => setPickerMinorOpen(true)}
                  >
                    Use existing claim
                  </button>
                </div>
                {selected.formalStructure.minorPremise && (
                  <div className="text-[11px] text-indigo-700 italic  px-2 py-1 rounded border w-fit bg-white border-indigo-200">
                    Template: {selected.formalStructure.minorPremise}
                  </div>
                )}
                {/* Variable hints */}
                {selected.premises && selected.premises[1]?.variables && selected.premises[1].variables.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-medium">Variables to include:</span>
                    <div className="flex gap-1 flex-wrap">
                      {selected.premises[1].variables.map((variable: string) => (
                        <code key={variable} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                          {`{${variable}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
                {minorPremise ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 border border-emerald-600/60 rounded-lg py-2 px-3 text-sm bg-emerald-50/50 flex items-center justify-between">
                      <span className="truncate">{minorPremise.text}</span>
                    </div>
                    <button
                      className="text-xs px-2 py-1 rounded-lg border border-rose-200 text-rose-700 bg-rose-50"
                      onClick={() => setMinorPremise(null)}
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg px-3 py-2 text-sm articlesearchfield"
                      placeholder="Enter minor premise..."
                      value={minorPremiseDraft}
                      onChange={(e) => setMinorPremiseDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && minorPremiseDraft.trim())
                          addMinorPremiseFromDraft();
                      }}
                    />
                    <button
                className="text-xs px-5 rounded-xl btnv2 bg-white"
                onClick={() => setExpandedPremiseEditor(true)}
                title="Open rich editor for complex premises"
              >
                ➾ Expand
              </button>
                    <button
                      className="text-xs px-4 rounded-xl bg-white btnv2"
                      disabled={!minorPremiseDraft.trim()}
                      onClick={addMinorPremiseFromDraft}
                    >
                      ⊕ Add
                    </button>
                  </div>
                )}
              </label>
            </div>
            {/* Phase B: Axiom designation checkbox */}
            <div className="p-3 rounded-lg bg-gradient-to-r from-orange-50 to-orange-100 border border-amber-200">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={premisesAreAxioms}
                  onChange={(e) => setPremisesAreAxioms(e.target.checked)}
                  className="mt-2 w-4 h-4 text-amber-600 bg-white border-amber-300 rounded focus:ring-amber-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-amber-900">
                    Mark premises as axioms (indisputable)
                  </span>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    Axioms are foundational premises that cannot be undermined and must be consistent with other axioms. 
                    Use for claims that are beyond dispute in this deliberation.
                  </p>
                </div>
              </label>
            </div>
            
          </div>
        ) : (
          /* Fallback: Freeform premises (original behavior) */
          <div className="mt-2">
            {/* Phase B: Axiom designation checkbox */}
            <div className="mb-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={premisesAreAxioms}
                  onChange={(e) => setPremisesAreAxioms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-amber-600 bg-white border-amber-300 rounded focus:ring-amber-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-amber-900">
                    Mark premises as axioms (indisputable)
                  </span>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    Axioms are foundational premises that cannot be undermined and must be consistent with other axioms. 
                    Use for claims that are beyond dispute in this deliberation (e.g., established facts, definitions, or shared assumptions).
                  </p>
                </div>
              </label>
            </div>
            
            <div className="flex items-center justify-start gap-3">
              <span className="text-sm text-gray-800">Premises</span>
              <button
                className="text-xs px-2 py-1 rounded-lg btnv2--ghost bg-white"
                onClick={() => setPickerPremOpen(true)}
              >
                + Add from existing
              </button>
            </div>

            {/* Variable hints for freeform premises */}
            {selected && selected.premises && selected.premises.some(p => p.variables && p.variables.length > 0) && (
              <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs font-medium text-slate-700 mb-2">Variables to include in your premises:</div>
                <div className="flex gap-2 flex-wrap">
                  {selected.premises.flatMap(p => p.variables || [])
                    .filter((v, i, arr) => arr.indexOf(v) === i) // unique
                    .map((variable: string) => (
                      <code key={variable} className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono text-xs">
                        {`{${variable}}`}
                      </code>
                    ))}
                </div>
              </div>
            )}

            {/* NEW: quick add by typing */}
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1  rounded-lg px-3 py-2 text-sm articlesearchfield"
                placeholder="Add a premise"
                value={premDraft}
                onChange={(e) => setPremDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && premDraft.trim())
                    addPremiseFromDraft();
                }}
              />
              <button
                className="text-xs px-5 rounded-xl btnv2 bg-white"
                onClick={() => setExpandedPremiseEditor(true)}
                title="Open rich editor for complex premises"
              >
                ➾ Expand
              </button>
              <button
                className="text-xs px-5   rounded-xl bg-white btnv2"
                disabled={!premDraft.trim()}
                onClick={addPremiseFromDraft}
              >
                ⊕ Add
              </button>
            </div>

            {premises.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {premises.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-1 rounded-full panel-edge bg-white/30"
                  >
                    <span className="text-xs">{p.text || p.id}</span>
                    <button
                      className="text-[10px] text-slate-500 underline"
                      onClick={() => removePremise(p.id)}
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500 mt-2">No premises yet.</div>
            )}
            
          </div>
          
        )}
 
        <hr className="border-slate-500/50 mt-4 mb-2" />

        

        {/* Evidence Requirements Panel - shown when scheme is selected, before argument creation */}
        {selected && !argumentId && (() => {
          const requirements = (selected as any).evidenceRequirements || inferEvidenceRequirements(selected);
          return requirements.length > 0 ? (
            <div className="my-4">
              <EvidenceRequirements requirements={requirements} />
            </div>
          ) : null;
        })()}

        {/* Optional implicit warrant / unstated assumption */}
              <label className="flex flex-col gap-2 border border-indigo-400 rounded-md px-2 py-3 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-800">Implicit Warrant (Optional)</span>
            <span className="text-xs text-gray-500">
              Missing premise that connects premises to conclusion
            </span>
          </div>
          <textarea
            className="w-full articlesearchfield rounded-lg text-xs px-2.5 py-2 mt-1"
            cols={3}
            value={implicitWarrantText}
            placeholder="Missing premise or general rule (e.g., 'All X are Y', 'Experts in X are reliable', 'If P then Q')"
            onChange={(e) => setImplicitWarrantText(e.target.value)}
          />
        </label>

        {/* Citations - Use CitationCollector for evidence attachment */}

        <div className="flex flex-col gap-2 border border-indigo-400 rounded-md px-2 py-3 mt-4">
          <CitationCollector
            citations={pendingCitations}
            onChange={setPendingCitations}
            className="w-full"
          />
        </div>

        {/* Phase 1b.3: Rule Type Selection (STRICT vs DEFEASIBLE) - Available for both scheme-based and freeform arguments */}
        
          <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200">
            <div className="flex items-start gap-2 mb-3">
              <span className="text-sky-600 text-sm">⚖️</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-sky-900">
                    Rule Type
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRuleTypeHelp(!showRuleTypeHelp)}
                    className="text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-700 hover:bg-sky-200"
                  >
                    {showRuleTypeHelp ? "Hide" : "Show"} explanation
                  </button>
                </div>
                <p className="text-xs text-sky-700 mt-1">
                  Choose whether this inference is logically guaranteed or open to rebuttal
                </p>
              </div>
            </div>

            {showRuleTypeHelp && (
              <div className="mb-3 p-3 rounded-lg bg-white border border-sky-200">
                <div className="space-y-2 text-xs text-slate-700">
                  <div>
                    <strong className="text-sky-900">Strict Rule:</strong> The conclusion follows logically from the premises. 
                    If the premises are true, the conclusion <em>must</em> be true. Cannot be rebutted (only undercut by challenging premises).
                    <div className="mt-1 text-slate-600 italic">Example: &ldquo;All humans are mortal. Socrates is human. Therefore, Socrates is mortal.&rdquo;</div>
                  </div>
                  <div>
                    <strong className="text-slate-900">Defeasible Rule (default):</strong> The conclusion is <em>plausible</em> given the premises, 
                    but could be false even if premises are true. Can be rebutted by showing an exception or alternative conclusion.
                    <div className="mt-1 text-slate-600 italic">Example: &ldquo;Birds typically fly. Tweety is a bird. Therefore, Tweety flies.&rdquo; (Rebuttable: &ldquo;But Tweety is a penguin&rdquo;)</div>
                  </div>
                </div>
              </div>
            )}

            <RadioGroup
              value={ruleType}
              onValueChange={(value) => setRuleType(value as 'STRICT' | 'DEFEASIBLE')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/50 transition-colors">
                <RadioGroupItem value="DEFEASIBLE" id="defeasible" />
                <label
                  htmlFor="defeasible"
                  className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900">Defeasible</span>
                    <Badge variant="outline" className="text-xs font-normal bg-slate-50">
                      Default
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-normal">
                    Conclusion is plausible but rebuttable (most arguments)
                  </p>
                </label>
              </div>

              <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/50 transition-colors">
                <RadioGroupItem value="STRICT" id="strict" />
                <label
                  htmlFor="strict"
                  className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sky-900">Strict</span>
                    <Badge variant="outline" className="text-xs font-normal bg-sky-100 border-sky-300 text-sky-700">
                      Logically guaranteed
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-normal">
                    Conclusion follows necessarily from premises (e.g., modus ponens)
                  </p>
                </label>
              </div>
            </RadioGroup>

            {ruleType === 'STRICT' && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 text-sm">⚠️</span>
                  <div className="flex-1">
                    <p className="text-xs text-amber-900 font-medium">
                      Strict rules require strong justification
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Ensure your inference pattern is truly <em>logically valid</em> (e.g., modus ponens, universal instantiation).
                      Opponents cannot rebut strict conclusions directly—they can only undercut by challenging premises or the rule itself.
                    </p>
                  </div>
                </div>

                {/* Phase 1c: Transposition closure explanation */}
                <div className="mt-3 p-2 rounded bg-sky-50 border border-sky-200">
                  <div className="flex items-start gap-2">
                    <span className="text-sky-600 text-xs">💡</span>
                    <div className="flex-1">
                      <p className="text-xs text-sky-900 font-medium">
                        Transposition Closure
                      </p>
                      <p className="text-xs text-sky-700 mt-1">
                        For logical consistency, strict rules should support <em>contrapositive reasoning</em> (modus tollens). 
                        If you create "<strong>P → Q</strong>", the system may warn if "<strong>¬Q → ¬P</strong>" is missing.
                      </p>
                      <div className="mt-2 text-xs text-sky-800 bg-sky-100 p-2 rounded">
                        <strong>Example:</strong> "rain → wet" should have "¬wet → ¬rain" for complete reasoning.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Optional rule name input for strict rules */}
                <div className="mt-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-700">
                      Rule name (optional)
                    </span>
                    <input
                      type="text"
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      placeholder="e.g., 'Modus Ponens', 'Universal Instantiation'"
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs text-slate-600">
                      Name the logical rule for reference in undercutting attacks
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
{/* CQ Preview Panel - shown when scheme is selected, before argument creation */}
        {selected && selected.cqs && selected.cqs.length > 0 && !argumentId && (
          <div className="my-4 p-4 rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 rounded-lg bg-orange-200">
                <svg className="w-5 h-5 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-orange-900 mb-1">
                  Critical Questions Preview
                </h4>
                <p className="text-xs text-orange-800 leading-relaxed">
                  This scheme comes with {selected.cqs.length} critical question{selected.cqs.length !== 1 ? "s" : ""} that will test your argument&apos;s strength. Review them before creating your argument.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {selected.cqs.slice(0, 4).map((cq, idx) => (
                <div 
                  key={cq.cqKey} 
                  className="flex items-start gap-2 p-2 bg-white/70 rounded-lg border border-orange-200"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-200 text-orange-800 text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-800 leading-relaxed">
                      {cq.text}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                        {cq.attackType}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {cq.targetScope}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {selected.cqs.length > 4 && (
                <div className="text-center pt-2">
                  <span className="text-xs font-medium text-orange-700">
                    ...+ {selected.cqs.length - 4} more question{selected.cqs.length - 4 !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 mt-4">
          <button
            className="px-5 py-2 text-xs tracking-wide font-medium rounded-full btnv2 bg-white disabled:opacity-50"
            disabled={creating || !canCreate}
            onClick={handleCreate}
          >
            {creating ? "Creating…" : "Create argument"}
          </button>
          {err && <span className="text-sm text-rose-700">{err}</span>}
        </div>

        {!!argumentId && !!cqs.length && (
          <div className="mt-4 border-t pt-3">
            {/* CQs section unchanged */}
          </div>
        )}
      </div>

      {/* Confidence & moves
      {hasConclusion && (
        <>
          <ClaimConfidence
            deliberationId={deliberationId}
            claimId={conclusionClaim.id!}
            mode="min"
            tau={0.7}
          />
          {hasConclusion && (
            <div
              className={!argumentId ? "opacity-60 pointer-events-none" : ""}
            >
              <LegalMoveToolbarAIF
                deliberationId={deliberationId}
                targetType="claim"
                targetId={conclusionClaim.id!}
                onPosted={() =>
                  window.dispatchEvent(
                    new CustomEvent("dialogue:moves:refresh", {
                      detail: { deliberationId },
                    } as any)
                  )
                }
              />
              {!argumentId && (
                <div className="text-xs text-slate-500 mt-1">
                  Create the argument first to enable GROUNDS/CLOSE here.
                </div>
              )}
            </div>
          )}
        </>
      )} */}

     

      {/* Premise picker modal
      <SchemeComposerPicker
        kind="claim"
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(it) => {
          setPremises(ps => ps.some(p => p.id === it.id) ? ps : [...ps, { id: it.id, text: it.label }]);
          setPickerOpen(false);
        }}
      /> */}
      {/* Pickers (separate modals for clarity) */}
      <SchemeComposerPicker
        kind="claim"
        open={pickerConcOpen}
        onClose={() => setPickerConcOpen(false)}
        onPick={(it) => {
          setConclusion({ id: it.id, text: it.label });
          setConclusionDraft(it.label || "");
          setEditingConclusion(false); // switch to read-only row immediately
          setPickerConcOpen(false);

          // micro-feedback chip
          setJustPicked(true);
          setTimeout(() => setJustPicked(false), 1200);
        }}
      />
      <SchemeComposerPicker
        kind="claim"
        open={pickerPremOpen}
        onClose={() => setPickerPremOpen(false)}
        onPick={(it) => {
          setPremises((ps) =>
            ps.some((p) => p.id === it.id)
              ? ps
              : [...ps, { id: it.id, text: it.label }]
          );
          setPickerPremOpen(false);
        }}
      />
      <SchemeComposerPicker
        kind="claim"
        open={pickerMajorOpen}
        onClose={() => setPickerMajorOpen(false)}
        onPick={(it) => {
          setMajorPremise({ id: it.id, text: it.label });
          setMajorPremiseDraft("");
          setPickerMajorOpen(false);
        }}
      />
      <SchemeComposerPicker
        kind="claim"
        open={pickerMinorOpen}
        onClose={() => setPickerMinorOpen(false)}
        onPick={(it) => {
          setMinorPremise({ id: it.id, text: it.label });
          setMinorPremiseDraft("");
          setPickerMinorOpen(false);
        }}
      />

      
      {/* Expanded rich editor modal for complex conclusion claims */}
      <Dialog open={expandedConclusionEditor} onOpenChange={setExpandedConclusionEditor}>
        <DialogContent className="max-w-3xl bg-white">
          <DialogHeader>
            <DialogTitle>Compose Conclusion Claim</DialogTitle>
          </DialogHeader>
          <PropositionComposerPro
            deliberationId={deliberationId}
            onCreated={async (prop) => {
              // PropositionComposerPro creates a Proposition, but we need a Claim for arguments.
              // Check if it has a promotedClaimId, otherwise create a new Claim from the text.
              let claimId = prop.promotedClaimId;
              if (!claimId && prop.text) {
                try {
                  claimId = await createClaim({ deliberationId, authorId, text: prop.text });
                } catch (e) {
                  console.error("Failed to create claim from proposition:", e);
                  // Fall back to just using the text without an ID
                  setConclusionDraft(prop.text);
                  setConclusion({ text: prop.text });
                  setExpandedConclusionEditor(false);
                  setEditingConclusion(false);
                  return;
                }
              }
              setConclusionDraft(prop.text);
              setConclusion({ id: claimId ?? undefined, text: prop.text });
              setExpandedConclusionEditor(false);
              setEditingConclusion(false);
              window.dispatchEvent(
                new CustomEvent("claims:changed", { detail: { deliberationId } })
              );
            }}
            onPosted={() => setExpandedConclusionEditor(false)}
            placeholder="State your conclusion claim with rich formatting..."
          />
        </DialogContent>
      </Dialog>

      {/* Expanded rich editor modal for complex premise claims */}
      <Dialog open={expandedPremiseEditor} onOpenChange={setExpandedPremiseEditor}>
        <DialogContent className="max-w-3xl bg-white">
          <DialogHeader>
            <DialogTitle>Compose Premise Claim</DialogTitle>
          </DialogHeader>
          <PropositionComposerPro
            deliberationId={deliberationId}
            onCreated={async (prop) => {
              // PropositionComposerPro creates a Proposition, but we need a Claim for arguments.
              // Check if it has a promotedClaimId, otherwise create a new Claim from the text.
              let claimId = prop.promotedClaimId;
              if (!claimId && prop.text) {
                try {
                  claimId = await createClaim({ deliberationId, authorId, text: prop.text });
                } catch (e) {
                  console.error("Failed to create claim from proposition:", e);
                  setErr("Failed to create premise claim");
                  return;
                }
              }
              if (claimId) {
                setPremises((ps) => [...ps, { id: claimId!, text: prop.text }]);
              }
              setPremDraft("");
              setExpandedPremiseEditor(false);
              window.dispatchEvent(
                new CustomEvent("claims:changed", { detail: { deliberationId } })
              );
            }}
            onPosted={() => setExpandedPremiseEditor(false)}
            placeholder="State your premise claim with rich formatting..."
          />
        </DialogContent>
      </Dialog>
      
      {/* Contradiction Warning Modal */}
      <ContradictionWarningModal
        isOpen={showContradictionModal}
        newCommitment={{
          text: conclusionDraft || conclusionClaim?.text || "",
          targetId: conclusionClaim?.id || "",
          targetType: "claim",
        }}
        contradictions={detectedContradictions}
        onConfirm={async () => {
          // User chose to commit anyway - retry with bypass flag
          if (pendingArgumentPayload) {
            setCreating(true);
            try {
              const id = await createArgument({
                ...pendingArgumentPayload,
                bypassContradictionCheck: true,
              });
              setArgumentId(id);
              onCreated?.(id);
              setShowContradictionModal(false);
              setPendingArgumentPayload(null);
              setDetectedContradictions([]);
              window.dispatchEvent(
                new CustomEvent("claims:changed", { detail: { deliberationId } })
              );
            } catch (err: any) {
              setErr(err.message || "Failed to create argument");
            } finally {
              setCreating(false);
            }
          }
        }}
        onRetract={async (commitmentId) => {
          // User chose to retract the existing commitment
          // Note: This would require implementing a retract endpoint
          console.log("Retract commitment:", commitmentId);
          setShowContradictionModal(false);
          // Optionally refresh commitments here
        }}
        onCancel={() => {
          // User canceled - just close modal
          setShowContradictionModal(false);
          setPendingArgumentPayload(null);
          setDetectedContradictions([]);
        }}
      />
    </div>
  );
}
