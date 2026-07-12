"use client";

/**
 * StackComposer
 * 
 * Phase 1.2 of Stacks Improvement Roadmap
 * 
 * Unified composer for adding blocks to stacks:
 * - PDF upload (existing flow)
 * - Link blocks (new)
 * - Text/Note blocks (new)
 * - Image blocks (future)
 * - Video blocks (new)
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  PlusIcon, 
  LinkIcon, 
  FileTextIcon, 
  ImageIcon, 
  VideoIcon, 
  FileIcon,
  XIcon,
  Loader2Icon,
  PlusCircle,
  LayersIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmbedStackModal } from "@/components/stack/modals/EmbedStackModal";

interface StackComposerProps {
  stackId: string;
  onBlockAdded?: (block: any) => void;
  className?: string;
}

type ComposerMode = null | "link" | "text" | "video" | "image" | "embed";

export function StackComposer({ stackId, onBlockAdded, className }: StackComposerProps) {
  const router = useRouter();
  const [mode, setMode] = React.useState<ComposerMode>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Form state
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkTitle, setLinkTitle] = React.useState("");
  const [textContent, setTextContent] = React.useState("");
  const [textTitle, setTextTitle] = React.useState("");
  const [textFormat, setTextFormat] = React.useState<"plain" | "markdown">("markdown");
  const [videoUrl, setVideoUrl] = React.useState("");
  const [videoTitle, setVideoTitle] = React.useState("");
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setLinkUrl("");
    setLinkTitle("");
    setTextContent("");
    setTextTitle("");
    setTextFormat("markdown");
    setVideoUrl("");
    setVideoTitle("");
    setError(null);
    setMode(null);
  };

  const handlePdfSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append("stackId", stackId);
      
      for (const file of files) {
        formData.append("files", file);
      }
      
      const res = await fetch("/api/library/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      
      const data = await res.json();
      onBlockAdded?.(data);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to upload PDF");
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmitLink = async () => {
    if (!linkUrl.trim()) {
      setError("URL is required");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const res = await fetch("/api/blocks/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stackId,
          url: linkUrl.trim(),
          title: linkTitle.trim() || undefined,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create link block");
      }
      
      const data = await res.json();
      onBlockAdded?.(data.block);
      resetForm();
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create link block");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitText = async () => {
    if (!textContent.trim()) {
      setError("Content is required");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const res = await fetch("/api/blocks/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stackId,
          content: textContent.trim(),
          title: textTitle.trim() || undefined,
          format: textFormat,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create text block");
      }
      
      const data = await res.json();
      onBlockAdded?.(data.block);
      resetForm();
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create text block");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitVideo = async () => {
    if (!videoUrl.trim()) {
      setError("Video URL is required");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const res = await fetch("/api/blocks/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stackId,
          url: videoUrl.trim(),
          title: videoTitle.trim() || undefined,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create video block");
      }
      
      const data = await res.json();
      onBlockAdded?.(data.block);
      resetForm();
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create video block");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Hidden file input for PDF uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      
      {/* Main dropdown trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
           
            className={cn("px-3 tracking-wide  py-4 text-sm bg-white/70 sendbutton rounded-lg text-center ", className)}

            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            Add Block
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => setMode("link")}>
            <LinkIcon className="h-4 w-4 mr-2" />
            Link
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setMode("text")}>
            <FileTextIcon className="h-4 w-4 mr-2" />
            Note
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handlePdfSelect}>
            <FileIcon className="h-4 w-4 mr-2" />
            PDF Document
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setMode("video")}>
            <VideoIcon className="h-4 w-4 mr-2" />
            Video
          </DropdownMenuItem>
          
          <DropdownMenuItem disabled>
            <ImageIcon className="h-4 w-4 mr-2" />
            Image
            <span className="ml-auto text-xs text-muted-foreground">Soon</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setMode("embed")}>
            <LayersIcon className="h-4 w-4 mr-2" />
            Embed Stack
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Link Dialog */}
      <Dialog open={mode === "link"} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Add Link</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://example.com/article"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="link-title">Title (optional)</Label>
              <Input
                id="link-title"
                placeholder="Custom title for the link"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-fetch from page metadata
              </p>
            </div>
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
            <Button variant="btnv2" onClick={handleSubmitLink} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Add Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Text/Note Dialog */}
      <Dialog open={mode === "text"} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="text-title">Title (optional)</Label>
              <Input
                id="text-title"
                placeholder="Note title"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="text-content">Content</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={textFormat === "plain" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setTextFormat("plain")}
                  >
                    Plain
                  </Button>
                  <Button
                    type="button"
                    variant={textFormat === "markdown" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setTextFormat("markdown")}
                  >
                    Markdown
                  </Button>
                </div>
              </div>
              <Textarea
                id="text-content"
                placeholder={textFormat === "markdown" 
                  ? "Write your note in **markdown**..."
                  : "Write your note..."}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleSubmitText} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Video Dialog */}
      <Dialog open={mode === "video"} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Add Video</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="video-url">Video URL</Label>
              <Input
                id="video-url"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Supports YouTube, Vimeo, Loom, and Wistia
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="video-title">Title (optional)</Label>
              <Input
                id="video-title"
                placeholder="Custom title for the video"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
              />
            </div>
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleSubmitVideo} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Add Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Embed Stack Modal */}
      <EmbedStackModal
        open={mode === "embed"}
        onClose={resetForm}
        parentStackId={stackId}
        onSuccess={() => {
          resetForm();
          router.refresh();
        }}
      />
    </>
  );
}

export default StackComposer;
