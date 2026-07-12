/**
 * Phase 5.1: Interactive field taxonomy browser
 */

"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, BookOpen, Layers, Hash } from "lucide-react";
import { useFieldHierarchy } from "@/lib/crossfield/hooks";
import { FieldHierarchy, EpistemicStyle } from "@/lib/crossfield/types";

interface FieldBrowserProps {
  onSelectField?: (fieldId: string) => void;
  selectedFieldId?: string;
}

export function FieldBrowser({
  onSelectField,
  selectedFieldId,
}: FieldBrowserProps) {
  const { data: hierarchy, isLoading } = useFieldHierarchy();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900">Academic Fields</h3>
        <p className="text-sm text-gray-500">Browse fields by discipline</p>
      </div>
      <div className="p-2 max-h-96 overflow-y-auto">
        {hierarchy?.map((field) => (
          <FieldNode
            key={field.id}
            field={field}
            level={0}
            onSelect={onSelectField}
            selectedId={selectedFieldId}
          />
        ))}
      </div>
    </div>
  );
}

interface FieldNodeProps {
  field: FieldHierarchy;
  level: number;
  onSelect?: (fieldId: string) => void;
  selectedId?: string;
}

function FieldNode({ field, level, onSelect, selectedId }: FieldNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = field.children.length > 0;
  const isSelected = field.id === selectedId;

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
          ${isSelected ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"}
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect?.(field.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <EpistemicIcon style={field.epistemicStyle} />

        <span className="text-sm font-medium">{field.name}</span>

        {hasChildren && (
          <span className="text-xs text-gray-400 ml-auto">
            {field.children.length}
          </span>
        )}
      </div>

      {expanded &&
        hasChildren &&
        field.children.map((child) => (
          <FieldNode
            key={child.id}
            field={child}
            level={level + 1}
            onSelect={onSelect}
            selectedId={selectedId}
          />
        ))}
    </div>
  );
}

function EpistemicIcon({ style }: { style: EpistemicStyle }) {
  const icons: Record<EpistemicStyle, React.ReactNode> = {
    EMPIRICAL: <Hash className="w-4 h-4 text-green-600" />,
    INTERPRETIVE: <BookOpen className="w-4 h-4 text-purple-600" />,
    FORMAL: <Layers className="w-4 h-4 text-blue-600" />,
    NORMATIVE: <span className="w-4 h-4 text-center text-orange-600 text-xs">&#9878;</span>,
    HISTORICAL: <span className="w-4 h-4 text-center text-amber-600 text-xs">&#9776;</span>,
    MIXED: <span className="w-4 h-4 text-center text-gray-600 text-xs">&#9678;</span>,
  };
  return <>{icons[style]}</>;
}
