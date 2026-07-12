"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SettingsIcon, Loader2Icon, CheckIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { VisibilitySelector, Visibility } from "@/components/stack/VisibilitySelector";

interface StackSettingsModalProps {
  stackId: string;
  initialName: string;
  initialDescription: string | null;
  initialVisibility: Visibility;
  initialSlug: string | null;
}

export function StackSettingsModal({ 
  stackId, 
  initialName, 
  initialDescription, 
  initialVisibility,
  initialSlug 
}: StackSettingsModalProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  
  const [name, setName] = React.useState(initialName);
  const [description, setDescription] = React.useState(initialDescription || "");
  const [visibility, setVisibility] = React.useState<Visibility>(initialVisibility);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription || "");
      setVisibility(initialVisibility);
      setError(null);
      setSuccess(false);
    }
  }, [open, initialName, initialDescription, initialVisibility]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Stack name is required");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    
    try {
      const res = await fetch(`/api/stacks/${stackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          visibility,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update stack");
      }
      
      setSuccess(true);
      router.refresh();
      
      // Close after short delay to show success
      setTimeout(() => {
        setOpen(false);
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
      <button className="flex gap-2 px-3 py-1 text-sm bg-white/70 w-full sendbutton rounded-md text-center text-slate-900 ">
          {/* <SettingsIcon className="h-4 w-4" /> */}
          Settings
      </button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md bg-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Stack Settings</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-stack-name">Name</Label>
            <Input
              id="edit-stack-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-stack-description">Description</Label>
            <Textarea
              id="edit-stack-description"
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
          
          {initialSlug && (
            <div className="text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">
              URL: /stacks/{initialSlug}
            </div>
          )}
          
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          
          {success && (
            <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckIcon className="h-4 w-4" />
              Settings saved!
            </p>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="btnv2" disabled={isSubmitting || success}>
              {isSubmitting ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : success ? (
                <>
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default StackSettingsModal;
