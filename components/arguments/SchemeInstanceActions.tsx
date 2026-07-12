// components/arguments/SchemeInstanceActions.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  MoreVertical, 
  Edit, 
  Star, 
  ArrowUp, 
  ArrowDown, 
  Trash2,
  Loader2
} from "lucide-react";
import { mutate as globalMutate } from "swr";
import type { ArgumentSchemeInstanceWithScheme } from "@/lib/types/argument-net";

interface SchemeInstanceActionsProps {
  argumentId: string;
  schemeInstance: ArgumentSchemeInstanceWithScheme;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canSetPrimary?: boolean;
  onEdit?: () => void;
  onSuccess?: () => void;
}

/**
 * SchemeInstanceActions - Dropdown menu for scheme instance operations
 * 
 * Actions:
 * - Edit: Opens edit modal
 * - Set as Primary: Changes role to primary
 * - Move Up/Down: Reorders scheme in list
 * - Remove: Deletes scheme instance with confirmation
 * 
 * Features:
 * - Confirmation dialog for destructive actions
 * - Loading states
 * - Validation (can't remove only primary scheme)
 * - Disable options based on state
 */
export function SchemeInstanceActions({
  argumentId,
  schemeInstance,
  canMoveUp = false,
  canMoveDown = false,
  canSetPrimary = true,
  onEdit,
  onSuccess
}: SchemeInstanceActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isPrimary = (schemeInstance as any).role === "primary" || schemeInstance.isPrimary;
  const schemeName = schemeInstance.scheme?.name || "this scheme";
  
  const handleSetPrimary = async () => {
    setIsUpdating(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/arguments/${argumentId}/schemes/${schemeInstance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "primary" })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to set as primary");
      }
      
      // Refresh data
      globalMutate(`/api/arguments/${argumentId}`);
      globalMutate(`/api/arguments/${argumentId}/schemes`);
      
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Failed to set as primary");
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleReorder = async (direction: "up" | "down") => {
    setIsUpdating(true);
    setError(null);
    
    const currentOrder = (schemeInstance as any).order || 0;
    const newOrder = direction === "up" ? currentOrder - 1 : currentOrder + 1;
    
    try {
      const response = await fetch(`/api/arguments/${argumentId}/schemes/${schemeInstance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: Math.max(0, newOrder) })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reorder");
      }
      
      // Refresh data
      globalMutate(`/api/arguments/${argumentId}`);
      globalMutate(`/api/arguments/${argumentId}/schemes`);
      
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Failed to reorder");
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/arguments/${argumentId}/schemes/${schemeInstance.id}`, {
        method: "DELETE"
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to remove scheme");
      }
      
      // Refresh data
      globalMutate(`/api/arguments/${argumentId}`);
      globalMutate(`/api/arguments/${argumentId}/schemes`);
      
      setShowDeleteDialog(false);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Failed to remove scheme");
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-48">
          {/* Edit */}
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            <span>Edit Details</span>
          </DropdownMenuItem>
          
          {/* Set as Primary */}
          {!isPrimary && canSetPrimary && (
            <DropdownMenuItem onClick={handleSetPrimary}>
              <Star className="mr-2 h-4 w-4" />
              <span>Set as Primary</span>
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          {/* Move Up */}
          <DropdownMenuItem 
            onClick={() => handleReorder("up")}
            disabled={!canMoveUp}
          >
            <ArrowUp className="mr-2 h-4 w-4" />
            <span>Move Up</span>
          </DropdownMenuItem>
          
          {/* Move Down */}
          <DropdownMenuItem 
            onClick={() => handleReorder("down")}
            disabled={!canMoveDown}
          >
            <ArrowDown className="mr-2 h-4 w-4" />
            <span>Move Down</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Remove */}
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Remove</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Scheme Instance?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <span className="font-semibold">{schemeName}</span> from this argument?
              {isPrimary && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠️ Warning: This is the primary scheme. Removing it may make the argument invalid unless you set another scheme as primary.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Scheme"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
