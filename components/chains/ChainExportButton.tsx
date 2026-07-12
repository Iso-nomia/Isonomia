"use client";

import React, { useState, useRef } from "react";
import { Download, Image as ImageIcon, FileCode, Network, FileText, Copy } from "lucide-react";
import { toPng, toSvg } from "html-to-image";
import { useReactFlow, type Node, type Edge } from "@xyflow/react";
import { useChainEditorStore } from "@/lib/stores/chainEditorStore";
import type { ChainNodeData, ChainEdgeData } from "@/lib/types/argumentChain";
import { generateNarrative, copyNarrativeToClipboard } from "@/lib/chains/narrativeGenerator";
import { downloadAsFile, generateFilename, getMimeType } from "@/lib/utils/fileExport";

interface ChainExportButtonProps {
  chainName?: string;
}

const ChainExportButton: React.FC<ChainExportButtonProps> = ({ chainName = "argument-chain" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const { getNodes, getEdges } = useReactFlow<Node<ChainNodeData>, Edge<ChainEdgeData>>();
  const { chainId } = useChainEditorStore();

  const showToast = (text: string, kind: "ok" | "err" = "ok", ms = 2500) => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), ms);
  };

  const handleExportPNG = async () => {
    setExporting(true);
    try {
      const viewport = document.querySelector(".react-flow__viewport") as HTMLElement;
      if (!viewport) {
        throw new Error("Viewport not found");
      }

      const dataUrl = await toPng(viewport, {
        backgroundColor: "#ffffff",
        quality: 1.0,
        pixelRatio: 2,
      });

      const link = document.createElement("a");
      link.download = `${chainName}.png`;
      link.href = dataUrl;
      link.click();

      setIsOpen(false);
    } catch (error) {
      console.error("Failed to export PNG:", error);
    } finally {
      setExporting(false);
    }
  };

  const handleExportSVG = async () => {
    setExporting(true);
    try {
      const viewport = document.querySelector(".react-flow__viewport") as HTMLElement;
      if (!viewport) {
        throw new Error("Viewport not found");
      }

      const dataUrl = await toSvg(viewport, {
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.download = `${chainName}.svg`;
      link.href = dataUrl;
      link.click();

      setIsOpen(false);
    } catch (error) {
      console.error("Failed to export SVG:", error);
    } finally {
      setExporting(false);
    }
  };

  const handleExportJSON = () => {
    setExporting(true);
    try {
      const nodes = getNodes();
      const edges = getEdges();
      const data = {
        chainName,
        exportedAt: new Date().toISOString(),
        nodes,
        edges,
      };

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.download = `${chainName}.json`;
      link.href = url;
      link.click();

      URL.revokeObjectURL(url);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to export JSON:", error);
    } finally {
      setExporting(false);
    }
  };

  const handleExportAIF = async () => {
    setExporting(true);
    try {
      if (!chainId) {
        throw new Error("Chain ID not available");
      }

      const response = await fetch(`/api/argument-chains/${chainId}/export/aif`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to export AIF");
      }

      const aifData = await response.json();
      const aifStr = JSON.stringify(aifData, null, 2);
      const blob = new Blob([aifStr], { type: "application/ld+json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.download = `${chainName}_aif.json`;
      link.href = url;
      link.click();

      URL.revokeObjectURL(url);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to export AIF:", error);
      showToast(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`, "err");
    } finally {
      setExporting(false);
    }
  };

  const handleExportNarrative = async (format: "text" | "markdown") => {
    setExporting(true);
    try {
      const nodes = getNodes();
      const edges = getEdges();

      if (nodes.length === 0) {
        showToast("No arguments to export", "err");
        return;
      }

      const result = generateNarrative(nodes, edges, chainName, {
        format,
        includeMetadata: true,
        tone: "formal",
        detailLevel: "standard",
        markdownOptions: format === "markdown" ? {
          includeToC: true, // Auto-enabled for chains >10
          includeFrontmatter: true,
          includeStatistics: true,
          includeSchemeDetails: true,
          numberingStyle: "sequential"
        } : undefined
      });

      const success = await copyNarrativeToClipboard(result.text);
      
      if (success) {
        const formatLabel = format === "markdown" ? "Markdown" : "Text";
        showToast(`✓ ${formatLabel} narrative copied to clipboard! (${result.metadata.nodeCount} arguments)`, "ok");
        setIsOpen(false);
      } else {
        throw new Error("Failed to copy to clipboard");
      }
    } catch (error) {
      console.error("Failed to export narrative:", error);
      showToast(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`, "err");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadNarrative = async (format: "text" | "markdown") => {
    setExporting(true);
    try {
      const nodes = getNodes();
      const edges = getEdges();

      if (nodes.length === 0) {
        showToast("No arguments to export", "err");
        return;
      }

      const result = generateNarrative(nodes, edges, chainName, {
        format,
        includeMetadata: true,
        tone: "formal",
        detailLevel: "standard",
        markdownOptions: format === "markdown" ? {
          includeToC: true,
          includeFrontmatter: true,
          includeStatistics: true,
          includeSchemeDetails: true,
          numberingStyle: "sequential"
        } : undefined
      });

      // Generate filename and download
      const extension = format === "markdown" ? "md" : "txt";
      const filename = generateFilename(chainName, extension);
      const mimeType = getMimeType(extension);
      
      downloadAsFile(result.text, filename, mimeType);
      
      const formatLabel = format === "markdown" ? "Markdown" : "Text";
      showToast(`✓ ${formatLabel} file downloaded! (${result.metadata.nodeCount} arguments)`, "ok");
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to download narrative:", error);
      showToast(`Download failed: ${error instanceof Error ? error.message : "Unknown error"}`, "err");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-y-auto max-h-[400px]">
            <div className="p-2 border-b bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Export Format
              </h3>
            </div>

            <div className="p-1">
              <button
                onClick={() => handleExportNarrative("text")}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Copy className="w-4 h-4 text-indigo-600" />
                <div className="flex-1 text-left">
                  <div className="font-medium">Copy Narrative (Text)</div>
                  <div className="text-xs text-gray-500">Plain text to clipboard</div>
                </div>
              </button>

              <button
                onClick={() => handleDownloadNarrative("text")}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <div className="flex-1 text-left">
                  <div className="font-medium">Download Narrative (Text)</div>
                  <div className="text-xs text-gray-500">Save as .txt file</div>
                </div>
              </button>

              <button
                onClick={() => handleExportNarrative("markdown")}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Copy className="w-4 h-4 text-indigo-600" />
                <div className="flex-1 text-left">
                  <div className="font-medium">Copy Narrative (Markdown)</div>
                  <div className="text-xs text-gray-500">Formatted to clipboard</div>
                </div>
              </button>

              <button
                onClick={() => handleDownloadNarrative("markdown")}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <div className="flex-1 text-left">
                  <div className="font-medium">Download Narrative (Markdown)</div>
                  <div className="text-xs text-gray-500">Save as .md file</div>
                </div>
              </button>

              <div className="my-1 border-t border-gray-200" />

              <button
                onClick={handleExportPNG}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded hover:bg-sky-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ImageIcon className="w-4 h-4 text-sky-600" />
                <div className="flex-1 text-left">
                  <div className="font-medium">PNG Image</div>
                  <div className="text-xs text-gray-500">High quality raster</div>
                </div>
              </button>

              <button
                onClick={handleExportSVG}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileCode className="w-4 h-4 text-purple-600" />
                <div className="flex-1 text-left">
                  <div className="font-medium">SVG Vector</div>
                  <div className="text-xs text-gray-500">Scalable vector graphics</div>
                </div>
              </button>

              <button
                onClick={handleExportJSON}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileCode className="w-4 h-4 text-green-600" />
                <div className="flex-1 text-left">
                  <div className="font-medium">JSON Data</div>
                  <div className="text-xs text-gray-500">Raw structured data</div>
                </div>
              </button>

              <button
                onClick={handleExportAIF}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Network className="w-4 h-4 text-orange-600" />
                <div className="flex-1 text-left">
                  <div className="font-medium">AIF Format</div>
                  <div className="text-xs text-gray-500">Argument Interchange (JSON-LD)</div>
                </div>
              </button>
            </div>

            {exporting && (
              <div className="p-3 border-t bg-sky-50">
                <div className="text-xs text-sky-700 font-medium">Exporting...</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          aria-live="polite"
          className={[
            "fixed bottom-4 right-4 z-50 rounded-md border px-3 py-2 text-xs shadow",
            "backdrop-blur bg-white/90",
            toast.kind === "ok"
              ? "border-emerald-200 text-emerald-700"
              : "border-rose-200 text-rose-700",
          ].join(" ")}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
};

export default ChainExportButton;
