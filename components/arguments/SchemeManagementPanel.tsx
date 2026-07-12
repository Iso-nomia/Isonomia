// components/arguments/SchemeManagementPanel.tsx
"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArgumentSchemeList } from "./ArgumentSchemeList";
import { AddSchemeToArgumentModal } from "./AddSchemeToArgumentModal";
import { EditSchemeInstanceModal } from "./EditSchemeInstanceModal";
import { Loader2, Edit, Eye } from "lucide-react";
import type { ArgumentWithSchemes, ArgumentSchemeInstanceWithScheme } from "@/lib/types/argument-net";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SchemeManagementPanelProps {
  argumentId: string;
}

/**
 * SchemeManagementPanel - Comprehensive UI for viewing and editing argument schemes
 * 
 * Features:
 * - View mode: Display-only ArgumentSchemeList
 * - Edit mode: Full editing capabilities with action buttons
 * - Tabs for switching between view and edit
 * - Add/Edit modals integrated
 * - Auto-refresh after changes
 */
export function SchemeManagementPanel({ argumentId }: SchemeManagementPanelProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingScheme, setEditingScheme] = useState<ArgumentSchemeInstanceWithScheme | null>(null);
  
  const { data: argument, error, isLoading, mutate } = useSWR<ArgumentWithSchemes>(
    `/api/arguments/${argumentId}`,
    fetcher
  );
  
  const handleSuccess = () => {
    mutate(); // Refresh data
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 bg-red-50 rounded-md">
        Failed to load argument data
      </div>
    );
  }
  
  if (!argument) {
    return (
      <div className="p-4 text-sm text-slate-500">
        Argument not found
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Mode Tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "view" | "edit")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="view" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            View
          </TabsTrigger>
          <TabsTrigger value="edit" className="flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Edit
          </TabsTrigger>
        </TabsList>
        
        {/* View Mode */}
        <TabsContent value="view" className="mt-4">
          <ArgumentSchemeList
            argument={argument}
            variant="detailed"
            showLegend={true}
            showConfidence={true}
            collapsible={false}
            editMode={false}
          />
        </TabsContent>
        
        {/* Edit Mode */}
        <TabsContent value="edit" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-amber-900">Edit Mode Active</p>
                <p className="text-xs text-amber-700 mt-1">
                  You can now add, edit, reorder, and remove schemes
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("view")}
              >
                Exit Edit Mode
              </Button>
            </div>
            
            <ArgumentSchemeList
              argument={argument}
              variant="detailed"
              showLegend={true}
              showConfidence={true}
              collapsible={false}
              editMode={true}
              onEdit={setEditingScheme}
              onAdd={() => setShowAddModal(true)}
              onActionSuccess={handleSuccess}
            />
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Add Scheme Modal */}
      <AddSchemeToArgumentModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        argumentId={argumentId}
        onSuccess={handleSuccess}
      />
      
      {/* Edit Scheme Modal */}
      {editingScheme && (
        <EditSchemeInstanceModal
          open={!!editingScheme}
          onOpenChange={(open) => !open && setEditingScheme(null)}
          argumentId={argumentId}
          schemeInstance={editingScheme}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
