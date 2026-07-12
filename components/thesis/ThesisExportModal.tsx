"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Download, FileText, FileCode, FileJson, CheckCircle2, AlertCircle } from "lucide-react";

interface ThesisExportModalProps {
  open: boolean;
  onClose: () => void;
  thesisId: string;
  thesisTitle: string;
}

type ExportFormat = "html" | "markdown" | "json";

interface FormatOption {
  value: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  estimatedSize: string;
}

export function ThesisExportModal({ open, onClose, thesisId, thesisTitle }: ThesisExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("html");
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [expandObjects, setExpandObjects] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const formats: FormatOption[] = [
    {
      value: "html",
      label: "HTML",
      description: "Standalone web page with styling, perfect for viewing in browsers or archiving",
      icon: <FileText className="w-5 h-5" />,
      estimatedSize: "~50-200 KB",
    },
    {
      value: "markdown",
      label: "Markdown",
      description: "Plain text format, ideal for version control, editing, and publishing platforms",
      icon: <FileCode className="w-5 h-5" />,
      estimatedSize: "~10-50 KB",
    },
    {
      value: "json",
      label: "JSON",
      description: "Structured data format with full metadata, useful for programmatic access",
      icon: <FileJson className="w-5 h-5" />,
      estimatedSize: "~20-100 KB",
    },
  ];

  const handleExport = async () => {
    try {
      setIsExporting(true);

      const params = new URLSearchParams({
        format: selectedFormat,
        metadata: includeMetadata.toString(),
        styles: "true",
        expand: expandObjects.toString(),
        download: "true",
      });

      // Trigger download
      const url = `/api/thesis/${thesisId}/export?${params.toString()}`;
      window.open(url, "_blank");

      // Success feedback
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Export error:", err);
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">Export Thesis</DialogTitle>
          <DialogDescription className="text-slate-600">
            Download a static snapshot of "<strong>{thesisTitle}</strong>" for archiving or distribution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Select Format</h3>
            <div className="space-y-2">
              {formats.map((format) => (
                <button
                  key={format.value}
                  onClick={() => setSelectedFormat(format.value)}
                  className={`w-full flex items-start gap-3 p-4 border-2 rounded-lg transition-all text-left ${
                    selectedFormat === format.value
                      ? "border-teal-500 bg-teal-50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 mt-0.5 ${
                      selectedFormat === format.value ? "text-teal-600" : "text-slate-400"
                    }`}
                  >
                    {format.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">{format.label}</span>
                      <span className="text-xs text-slate-500">{format.estimatedSize}</span>
                      {selectedFormat === format.value && (
                        <CheckCircle2 className="w-4 h-4 text-teal-600 ml-auto" />
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{format.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Export Options</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <div className="font-medium text-slate-900">Include Metadata</div>
                  <div className="text-sm text-slate-600">
                    Add title, author, publish date, and abstract to the export
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expandObjects}
                  onChange={(e) => setExpandObjects(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <div className="font-medium text-slate-900">Expand Deliberation Objects</div>
                  <div className="text-sm text-slate-600">
                    Show full details of claims and arguments instead of references
                  </div>
                  <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Note: This will increase file size and may take longer to generate
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Info Banner */}
          <Alert className="bg-sky-50 border-sky-200 flex gap-2">
            <AlertCircle className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-sky-800">
              <strong>Static Snapshot:</strong> The exported file is a point-in-time copy. Any future changes to your
              thesis or linked objects will not be reflected in this export.
            </div>
          </Alert>

          {/* Preview Info */}
          {selectedFormat === "html" && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">HTML Export Features</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>✓ Professional styling with readable typography</li>
                <li>✓ Responsive design for all screen sizes</li>
                <li>✓ Print-optimized for PDF conversion</li>
                <li>✓ Embedded CSS (no external dependencies)</li>
                <li>✓ Highlighted claims, arguments, and citations</li>
              </ul>
            </div>
          )}

          {selectedFormat === "markdown" && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Markdown Export Features</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>✓ Compatible with GitHub, GitLab, and Notion</li>
                <li>✓ Plain text format for easy version control</li>
                <li>✓ Preserves headings, lists, and formatting</li>
                <li>✓ Links to citations maintained</li>
                <li>✓ Object references shown as inline markers</li>
              </ul>
            </div>
          )}

          {selectedFormat === "json" && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">JSON Export Features</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>✓ Complete thesis structure and metadata</li>
                <li>✓ TipTap JSONContent format preserved</li>
                <li>✓ Programmatic access to all data</li>
                <li>✓ Suitable for backup and migration</li>
                <li>✓ Can be re-imported into compatible systems</li>
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {isExporting ? (
              <>
                <Download className="w-4 h-4 mr-2 animate-pulse" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download {selectedFormat.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
