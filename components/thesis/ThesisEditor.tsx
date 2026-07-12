/* eslint-disable max-lines */
"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Link from "@tiptap/extension-link";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import useSWR, { mutate } from "swr";
import {
  FileText,
  Save,
  Eye,
  Settings,
  BookPlus,
  ChevronLeft,
  Sparkles,
  MessageSquare,
  Quote,
  Link as LinkIcon,
  BookOpen,
  Lightbulb,
  Plus,
  Download,
  PlusCircle,
  SearchCode,
  LocateFixed,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { ClaimNode } from "@/lib/tiptap/extensions/claim-node";
import { ArgumentNode } from "@/lib/tiptap/extensions/argument-node";
import { CitationNode } from "@/lib/tiptap/extensions/citation-node";
import { TheoryWorkNode } from "@/lib/tiptap/extensions/theorywork-node";
import { PropositionNode } from "@/lib/tiptap/extensions/proposition-node";
import {
  ArgumentChainNode,
  type ChainEmbedRole,
} from "@/lib/tiptap/extensions/argument-chain-node";
import { ClaimPicker } from "@/components/claims/ClaimPicker";
import { ArgumentPicker } from "@/components/arguments/ArgumentPicker";
import {
  ArgumentChainPicker,
  type PickedChain,
} from "@/components/thesis/ArgumentChainPicker";
import { ThesisPublishConfirmation } from "@/components/thesis/ThesisPublishConfirmation";
import { ThesisExportModal } from "@/components/thesis/ThesisExportModal";
import { PropositionComposerPro } from "@/components/propositions/PropositionComposerPro";
import { extractDraftObjects, validateDraftObjects } from "@/lib/thesis/draft-utils";
import type { DraftInventory, ValidationError } from "@/lib/thesis/draft-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlusHexagon } from "@mynaui/icons-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ThesisEditorProps {
  thesisId: string;
  deliberationId: string;
}

type ThesisStatus = "DRAFT" | "SUBMITTED" | "PUBLISHED" | "ARCHIVED";
type ThesisTemplate = "LEGAL_DEFENSE" | "POLICY_CASE" | "ACADEMIC_THESIS" | "GENERAL";

type Thesis = {
  id: string;
  slug: string;
  title: string;
  abstract?: string;
  content?: JSONContent;
  status: ThesisStatus;
  template: ThesisTemplate;
  authorId: string;
  deliberationId?: string;
  createdAt: string;
  updatedAt: string;
};

export default function ThesisEditor({ thesisId, deliberationId }: ThesisEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [template, setTemplate] = useState<ThesisTemplate>("GENERAL");
  const [isSaving, setIsSaving] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const [authorId, setAuthorId] = useState<string>("");

  // Picker modals state
  const [showClaimPicker, setShowClaimPicker] = useState(false);
  const [showArgumentPicker, setShowArgumentPicker] = useState(false);
  const [showChainPicker, setShowChainPicker] = useState(false);

  // Publish confirmation state
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [draftInventory, setDraftInventory] = useState<DraftInventory | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);

  // Rich editor modals for composing new objects
  const [showPropositionEditor, setShowPropositionEditor] = useState(false);
  const [showClaimEditor, setShowClaimEditor] = useState(false);

  // Fetch thesis data
  const { data, error: fetchError } = useSWR<{ ok: boolean; thesis: Thesis }>(
    `/api/thesis/${thesisId}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const thesis = data?.thesis;

  // Initialize form from fetched data
  useEffect(() => {
    if (thesis) {
      setTitle(thesis.title || "");
      setAbstract(thesis.abstract || "");
      setTemplate(thesis.template);
      // Set authorId from thesis data
      setAuthorId(thesis.authorId || "");
    }
  }, [thesis]);

  // TipTap editor setup
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-teal-600 underline hover:text-teal-700",
        },
      }),
      Placeholder.configure({
        placeholder: "Begin composing your thesis. Use the toolbar to insert claims, arguments, and other deliberation objects...",
      }),
      CharacterCount,
      ClaimNode,
      ArgumentNode,
      CitationNode,

      PropositionNode,
      ArgumentChainNode,
    ],
    content: thesis?.content || { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class: "prose prose-slate max-w-none focus:outline-none min-h-[500px] px-12 py-8",
      },
    },
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getJSON());
    },
  });

  // Update editor content when thesis loads
  useEffect(() => {
    if (editor && thesis?.content && !editor.isDestroyed) {
      editor.commands.setContent(thesis.content);
    }
  }, [editor, thesis?.content]);

  // Autosave function
  const saveThesis = useCallback(
    async (content: JSONContent) => {
      if (!thesisId) return;

      try {
        setIsSaving(true);
        const res = await fetch(`/api/thesis/${thesisId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || "Untitled Thesis",
            abstract,
            template,
            content,
          }),
        });

        if (!res.ok) throw new Error("Failed to save");

        setLastSaved(new Date());
        mutate(`/api/thesis/${thesisId}`);
      } catch (err: any) {
        console.error("Save error:", err);
        toast.error("Failed to save thesis");
      } finally {
        setIsSaving(false);
      }
    },
    [thesisId, title, abstract, template]
  );

  const debouncedSave = useDebouncedCallback((content: JSONContent) => {
    saveThesis(content);
  }, 2000);

  // Manual save
  const handleManualSave = useCallback(() => {
    if (editor) {
      saveThesis(editor.getJSON());
    }
  }, [editor, saveThesis]);

  // Publish - show confirmation modal with draft inventory
  const handlePublish = useCallback(async () => {
    if (!thesisId || !title.trim()) {
      toast.error("Please add a title before publishing");
      return;
    }

    if (!editor) {
      toast.error("Editor not ready");
      return;
    }

    // Extract draft objects from current content
    const content = editor.getJSON();
    const inventory = extractDraftObjects(content);
    const validation = validateDraftObjects(inventory);

    setDraftInventory(inventory);
    setValidationErrors(validation.errors);
    setShowPublishConfirm(true);
  }, [thesisId, title, editor]);

  // Callback after successful publication
  const handlePublishComplete = useCallback(() => {
    toast.success("Thesis published!");
    mutate(`/api/thesis/${thesisId}`);
    router.push(`/deliberations/${deliberationId}/thesis/${thesisId}/view`);
  }, [thesisId, deliberationId, router]);

  // Auto-resize title textarea
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.style.height = "auto";
      titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
    }
  }, [title]);

  // Handlers for inserting nodes
  const handleInsertClaim = useCallback((claim: any) => {
    if (!editor) return;
    
    editor
      .chain()
      .focus()
      .insertContent({
        type: "claimNode",
        attrs: {
          claimId: claim.id,
          claimText: claim.text,
          position: claim.position || "UNDEC",
          authorName: claim.author?.username || claim.author?.name,
        },
      })
      .run();
    
    setShowClaimPicker(false);
    toast.success("Claim inserted");
  }, [editor]);

  const handleInsertArgument = useCallback((argument: any) => {
    if (!editor) return;
    
    // Use conclusion text as the primary argument text (following AIFArgumentsListPro pattern)
    const argumentText = argument.aif?.conclusion?.text || argument.text || "";
    
    editor
      .chain()
      .focus()
      .insertContent({
        type: "argumentNode",
        attrs: {
          argumentId: argument.id,
          text: argumentText,
          scheme: argument.aif?.scheme?.name || argument.aif?.scheme?.key,
          role: "PREMISE", // Default role; could be enhanced later
          authorName: null, // Could add author info to search results if needed
          premises: argument.aif?.premises || null,
          implicitWarrant: argument.aif?.implicitWarrant || null,
          cq: argument.aif?.cq || null,
          attacks: argument.aif?.attacks || null,
          preferences: argument.aif?.preferences || null,
        },
      })
      .run();
    
    setShowArgumentPicker(false);
    toast.success("Argument inserted");
  }, [editor]);

  // D4 Week 1–2: insert an existing ArgumentChain as an embedded canvas.
  const handleInsertChain = useCallback(
    (chain: PickedChain) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "argumentChainNode",
          attrs: {
            chainId: chain.id,
            chainName: chain.name,
            caption: chain.caption ?? null,
            role: chain.role as ChainEmbedRole,
            showEnabler: false,
            highlightNodes: [],
          },
        })
        .run();
      setShowChainPicker(false);
      toast.success("Argument chain inserted");
    },
    [editor],
  );

  // Handlers for inserting newly created objects via rich editors
  const handleInsertDraftClaim = useCallback(() => {
    setShowClaimEditor(true);
  }, []);

  const handleInsertDraftProposition = useCallback(() => {
    setShowPropositionEditor(true);
  }, []);

  // Handler for when a proposition is created in the rich editor
  const handlePropositionCreated = useCallback(async (prop: any) => {
    if (!editor) return;
    
    // Fetch citation count for the proposition
    let citationCount = 0;
    try {
      const citRes = await fetch(`/api/propositions/${prop.id}/citations`);
      if (citRes.ok) {
        const citData = await citRes.json();
        citationCount = citData.citations?.length || 0;
      }
    } catch (err) {
      console.error("Failed to fetch citations:", err);
    }
    
    // Insert the proposition as a rendered node (not a draft)
    editor
      .chain()
      .focus()
      .insertContent({
        type: "propositionNode",
        attrs: {
          propositionId: prop.id,
          propositionText: prop.text,
          mediaUrl: prop.mediaUrl || null,
          authorName: null, // Could add author info if available
          citationCount,
        },
      })
      .run();
    
    setShowPropositionEditor(false);
    toast.success("Proposition inserted");
  }, [editor]);

  // Handler for when a claim is created in the rich editor
  const handleClaimCreated = useCallback(async (prop: any) => {
    if (!editor) return;
    
    try {
      // Auto-promote proposition to claim
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          text: prop.text,
        }),
      });

      const data = await res.json();
      const claimId = data?.claim?.id ?? data?.claimId;

      if (!claimId) {
        throw new Error("Failed to create claim");
      }

      // Insert the claim as a rendered node (not a draft)
      editor
        .chain()
        .focus()
        .insertContent({
          type: "claimNode",
          attrs: {
            claimId: claimId,
            claimText: prop.text,
            position: "UNDEC",
            authorName: null, // Could add author info if available
          },
        })
        .run();
      
      setShowClaimEditor(false);
      toast.success("Claim inserted");

      // Dispatch event for claim lists to update
      window.dispatchEvent(
        new CustomEvent("claims:changed", { detail: { deliberationId } })
      );
    } catch (error: any) {
      console.error("Failed to create claim:", error);
      toast.error(error.message || "Failed to create claim");
    }
  }, [editor, deliberationId]);

  if (fetchError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-rose-600 mb-4">Failed to load thesis</p>
          <button
            onClick={() => router.push(`/deliberations/${deliberationId}`)}
            className="px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300"
          >
            Back to Deliberation
          </button>
        </div>
      </div>
    );
  }

  if (!thesis || !editor) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600">Loading editor...</p>
        </div>
      </div>
    );
  }

  const wordCount = editor.storage.characterCount?.words() || 0;
  const charCount = editor.storage.characterCount?.characters() || 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-8xl mx-auto px-12 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/deliberation/${deliberationId}`)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Back to deliberation"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <FileText className="w-5 h-5 text-teal-600" />
            <span className="text-lg font-medium text-slate-700">Thesis Editor</span>
            {isSaving && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <div className="animate-spin h-3 w-3 border-2 border-teal-600 border-t-transparent rounded-full" />
                Saving...
              </span>
            )}
            {!isSaving && lastSaved && (
              <span className="text-xs text-slate-500">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Metadata
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handlePublish}
              className="btnv2 px-4 py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-semibold rounded-lg hover:from-teal-700 hover:to-cyan-700 transition-all flex items-center gap-2"
            >
              <BookPlus className="w-4 h-4" />
              Publish
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <span>{wordCount} words</span>
              <span>•</span>
              <span>{charCount} characters</span>
              <span>•</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                thesis.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" :
                thesis.status === "DRAFT" ? "bg-slate-100 text-slate-700" :
                "bg-amber-100 text-amber-800"
              }`}>
                {thesis.status}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Template: {template.replace(/_/g, " ")}
            </div>
          </div>
        </div>
      </div>

      {/* Metadata Panel (collapsible) */}
      {showMetadata && (
        <div className="max-w-4xl mx-auto mt-6 px-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Document Metadata</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Template
                </label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as ThesisTemplate)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="GENERAL">General</option>
                  <option value="LEGAL_DEFENSE">Legal Defense</option>
                  <option value="POLICY_CASE">Policy Case</option>
                  <option value="ACADEMIC_THESIS">Academic Thesis</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Abstract / Summary
                </label>
                <textarea
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  placeholder="Brief summary of your thesis (optional)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Editor */}
      <div className="max-w-4xl mx-auto mt-5 px-4 pb-24">
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          {/* Title */}
          <div className="border-b border-slate-200 px-8 pt-6 pb-3">
            <textarea
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thesis Title"
              className="w-full text-2xl font-semibold tracking-wide text-slate-900 placeholder:text-slate-300 focus:outline-none resize-none overflow-hidden"
              rows={1}
            />
          </div>

          {/* Toolbar for inserting objects */}
          <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-2">
            <div className="flex items-center gap-1">
              {/* Compose New Objects */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
                <button
                  onClick={handleInsertDraftProposition}
                  className="px-1 py-1.5 text-sm text-purple-700 hover:bg-purple-50 hover:shadow-sm rounded-lg transition-all flex items-center gap-1 font-medium"
                  title="Compose new proposition inline"
                >
                  <PlusCircle className="w-4 h-4" />
                  
                  New Proposition
                </button>
                <button
                  onClick={handleInsertDraftClaim}
                  className="px-1 py-1.5 text-sm text-teal-700 hover:bg-teal-50 hover:shadow-sm rounded-lg transition-all flex items-center gap-1 font-medium"
                  title="Compose new claim inline"
                >
                  <PlusHexagon className="w-4 h-4" />
                  New Claim
                </button>
              </div>
                            <SearchCode className="ml-3  flex items-center w-4 h-4 text-slate-700" />

              <div className="flex mr-2 text-sm gap-1" > Select: </div>
              {/* Insert Existing Objects */}
              <button
                onClick={() => setShowClaimPicker(true)}
                className="px-1 py-1.5  text-sm text-slate-700  rounded-lg hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center gap-1"
                title="Insert existing claim"
              >
                <LocateFixed className="w-4 h-4" />
                Claim
              </button>
              <button
                onClick={() => setShowArgumentPicker(true)}
                className="px-1 py-1.5 text-sm text-slate-700 hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center gap-1"
                title="Insert existing argument"
              >
                <Quote className="w-4 h-4" />
                Argument
              </button>
              <button
                onClick={() => setShowChainPicker(true)}
                className="px-1 py-1.5 text-sm text-slate-700 hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center gap-1"
                title="Insert existing argument chain"
              >
                <Lightbulb className="w-4 h-4" />
                Chain
              </button>
              <button
                className="px-1 py-1.5 text-sm text-slate-400 cursor-not-allowed rounded-lg flex items-center gap-1"
                title="Insert citation (coming soon)"
                disabled
              >
                <LinkIcon className="w-4 h-4" />
                Citation
              </button>
             
            </div>
          </div>

          {/* Editor Content */}
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Claim Picker Modal */}
      <ClaimPicker
        deliberationId={deliberationId}
        open={showClaimPicker}
        onClose={() => setShowClaimPicker(false)}
        onPick={handleInsertClaim}
        allowCreate={true}
      />

      {/* Argument Picker Modal */}
      <ArgumentPicker
        deliberationId={deliberationId}
        open={showArgumentPicker}
        onClose={() => setShowArgumentPicker(false)}
        onPick={handleInsertArgument}
      />

      {/* Argument Chain Picker Modal (D4 Week 1–2) */}
      <ArgumentChainPicker
        deliberationId={deliberationId}
        open={showChainPicker}
        onClose={() => setShowChainPicker(false)}
        onPick={handleInsertChain}
      />

      {/* Publish Confirmation Modal */}
      {draftInventory && (
        <ThesisPublishConfirmation
          open={showPublishConfirm}
          onClose={() => setShowPublishConfirm(false)}
          thesisId={thesisId}
          inventory={draftInventory}
          validationErrors={validationErrors}
          onPublishComplete={handlePublishComplete}
        />
      )}

      {/* Export Modal */}
      <ThesisExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        thesisId={thesisId}
        thesisTitle={title || "Untitled Thesis"}
      />

      {/* Rich Editor Modal for Propositions */}
      <Dialog open={showPropositionEditor} onOpenChange={setShowPropositionEditor}>
        <DialogContent className="max-w-3xl bg-white">
          <DialogHeader>
            <DialogTitle>Compose Proposition</DialogTitle>
          </DialogHeader>
          <PropositionComposerPro
            deliberationId={deliberationId}
            onCreated={(prop) => {
              handlePropositionCreated(prop);
              window.dispatchEvent(
                new CustomEvent("claims:changed", { detail: { deliberationId } })
              );
            }}
            onPosted={() => setShowPropositionEditor(false)}
            placeholder="State your proposition with rich formatting..."
          />
        </DialogContent>
      </Dialog>

      {/* Rich Editor Modal for Claims */}
      <Dialog open={showClaimEditor} onOpenChange={setShowClaimEditor}>
        <DialogContent className="max-w-3xl bg-white">
          <DialogHeader>
            <DialogTitle>Compose Claim</DialogTitle>
          </DialogHeader>
          <PropositionComposerPro
            deliberationId={deliberationId}
            onCreated={(prop) => {
              handleClaimCreated(prop);
              window.dispatchEvent(
                new CustomEvent("claims:changed", { detail: { deliberationId } })
              );
            }}
            onPosted={() => setShowClaimEditor(false)}
            placeholder="State your claim with rich formatting..."
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
