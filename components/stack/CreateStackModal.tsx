"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { XIcon, Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { VisibilitySelector, Visibility } from "@/components/stack/VisibilitySelector";

interface CreateStackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (stack: { id: string; slug: string }) => void;
}

export function CreateStackModal({ open, onOpenChange, onSuccess }: CreateStackModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [visibility, setVisibility] = React.useState<Visibility>("private");

  const resetForm = () => {
    setName("");
    setDescription("");
    setVisibility("private");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Stack name is required");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const res = await fetch("/api/stacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          visibility,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create stack");
      }
      
      const data = await res.json();
      resetForm();
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess(data);
      } else {
        // Navigate to the new stack
        router.push(`/stacks/${data.id}`);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle>Create New Stack</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="stack-name">Name</Label>
            <Input
              id="stack-name"
              placeholder="My Reading List"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={isSubmitting}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="stack-description">Description (optional)</Label>
            <Textarea
              id="stack-description"
              placeholder="A collection of interesting papers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Visibility</Label>
            <VisibilitySelector
              value={visibility}
              onChange={setVisibility}
              disabled={isSubmitting}
            />
          </div>
          
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          
          <DialogFooter className="gap-2 h-full sm:gap-0">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="btnv2" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Create Stack"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateStackModal;
