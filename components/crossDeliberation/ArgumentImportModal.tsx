"use client";

import React, { useState } from "react";
import { useImportArgument } from "@/lib/crossDeliberation/hooks";
import { ImportType } from "@/lib/crossDeliberation/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  FileText,
  Layers,
  Link,
  AlertCircle,
} from "lucide-react";

interface ArgumentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceArgument: {
    id: string;
    summary: string;
    author: { name: string };
    deliberation: { id: string; title: string };
  };
  targetDeliberationId: string;
}

const importTypeOptions: Array<{
  type: ImportType;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    type: "FULL",
    label: "Full Import",
    description: "Import complete argument with all premises and conclusion",
    icon: Download,
  },
  {
    type: "PREMISES_ONLY",
    label: "Premises Only",
    description: "Import premises but write your own conclusion",
    icon: FileText,
  },
  {
    type: "SKELETON",
    label: "Structure Only",
    description: "Import argument structure without specific claims",
    icon: Layers,
  },
  {
    type: "REFERENCE",
    label: "Reference",
    description: "Just cite the argument without copying",
    icon: Link,
  },
];

export default function ArgumentImportModal({
  isOpen,
  onClose,
  sourceArgument,
  targetDeliberationId,
}: ArgumentImportModalProps) {
  const [importType, setImportType] = useState<ImportType>("FULL");
  const [preserveAttribution, setPreserveAttribution] = useState(true);
  const [importReason, setImportReason] = useState("");

  const importMutation = useImportArgument();

  const handleImport = async () => {
    try {
      await importMutation.mutateAsync({
        sourceArgumentId: sourceArgument.id,
        targetDeliberationId,
        importType,
        importReason: importReason || undefined,
        preserveAttribution,
      });
      onClose();
    } catch (error) {
      console.error("Import failed:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Import Argument
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source argument info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900 line-clamp-2">
              {sourceArgument.summary}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              by {sourceArgument.author.name} in{" "}
              {sourceArgument.deliberation.title}
            </p>
          </div>

          {/* Import type selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Import Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {importTypeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = importType === option.type;

                return (
                  <button
                    key={option.type}
                    onClick={() => setImportType(option.type)}
                    className={`p-3 rounded-lg border text-left transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className={`w-4 h-4 ${
                          isSelected ? "text-blue-600" : "text-gray-500"
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          isSelected ? "text-blue-900" : "text-gray-900"
                        }`}
                      >
                        {option.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Attribution toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-sm font-medium text-gray-700">
                Preserve attribution
              </span>
              <p className="text-xs text-gray-500">
                Credit the original author
              </p>
            </div>
            <button
              onClick={() => setPreserveAttribution(!preserveAttribution)}
              className={`relative w-10 h-6 rounded-full transition ${
                preserveAttribution ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  preserveAttribution ? "left-5" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Import reason */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Reason for import (optional)
            </label>
            <textarea
              value={importReason}
              onChange={(e) => setImportReason(e.target.value)}
              placeholder="Why are you importing this argument?"
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {importMutation.isPending ? (
              <>
                <span className="animate-spin">&#x23F3;</span>
                Importing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Import
              </>
            )}
          </button>
        </div>

        {importMutation.isError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            Failed to import argument. Please try again.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
