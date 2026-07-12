"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Library,
  Search,
  Star,
  Clock,
  Users,
  BookmarkPlus,
  Share2,
  Copy,
  Trash2,
  Edit,
  X,
  ChevronDown,
  TrendingUp,
  Sparkles,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface SavedTemplate {
  id: string;
  name: string;
  description?: string;
  schemeId: string;
  schemeName: string;
  filledPremises: Record<string, string>;
  variables: Record<string, string>;
  evidenceLinks: Record<string, string[]>;
  userId: string;
  userName: string;
  isPublic: boolean;
  usageCount: number;
  rating: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isFavorite?: boolean;
}

interface TemplateLibraryProps {
  onSelectTemplate?: (template: SavedTemplate) => void;
  mode?: "select" | "manage";
  currentTemplate?: {
    schemeId: string;
    schemeName: string;
    filledPremises: Record<string, string>;
    variables: Record<string, string>;
    evidenceLinks: Record<string, string[]>;
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function TemplateLibrary({ 
  onSelectTemplate, 
  mode = "select",
  currentTemplate 
}: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "rating">("recent");
  const [activeTab, setActiveTab] = useState<"my-templates" | "community" | "favorites">(
    "my-templates"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tab: activeTab,
        sortBy: sortBy,
      });

      if (selectedTags.length > 0) {
        params.append("tags", selectedTags.join(","));
      }

      const response = await fetch(`/api/templates?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      } else {
        setError("Failed to load templates");
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
      setError("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, sortBy, selectedTags]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  async function saveCurrentAsTemplate(template: Partial<SavedTemplate>) {
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates((prev) => [data.template, ...prev]);
        return data.template;
      }
    } catch (err) {
      console.error("Failed to save template:", err);
      throw err;
    }
  }

  async function deleteTemplate(templateId: string) {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  }

  async function duplicateTemplate(templateId: string) {
    try {
      const response = await fetch(`/api/templates/${templateId}/duplicate`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates((prev) => [data.template, ...prev]);
      }
    } catch (err) {
      console.error("Failed to duplicate template:", err);
    }
  }

  async function toggleFavorite(templateId: string) {
    try {
      const response = await fetch(`/api/templates/${templateId}/favorite`, {
        method: "POST",
      });

      if (response.ok) {
        // Update local state
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === templateId ? { ...t, isFavorite: !t.isFavorite } : t
          )
        );
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.schemeName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTags =
      selectedTags.length === 0 || selectedTags.some((tag) => template.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  const allTags = Array.from(new Set(templates.flatMap((t) => t.tags)));

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            <CardTitle>Template Library</CardTitle>
          </div>
          {mode === "select" && currentTemplate && (
            <SaveTemplateDialog 
              onSave={saveCurrentAsTemplate} 
              currentTemplate={currentTemplate}
            />
          )}
        </div>
        <CardDescription>
          Browse and use argument templates to speed up construction
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Search and filters */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
          </div>

          {/* Tag filters */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Tags:</span>
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="my-templates">
              <Edit className="h-4 w-4 mr-1" />
              My Templates
            </TabsTrigger>
            <TabsTrigger value="community">
              <Users className="h-4 w-4 mr-1" />
              Community
            </TabsTrigger>
            <TabsTrigger value="favorites">
              <Star className="h-4 w-4 mr-1" />
              Favorites
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-3 mt-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full mb-4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onSelect={() => onSelectTemplate?.(template)}
                      onDelete={() => deleteTemplate(template.id)}
                      onDuplicate={() => duplicateTemplate(template.id)}
                      onToggleFavorite={() => toggleFavorite(template.id)}
                      showActions={mode === "manage" || activeTab === "my-templates"}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Template Card
// ============================================================================

interface TemplateCardProps {
  template: SavedTemplate;
  onSelect?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleFavorite?: () => void;
  showActions?: boolean;
}

function TemplateCard({
  template,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  showActions = true,
}: TemplateCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className="hover:bg-muted/50 transition-all">
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{template.name}</h3>
                {template.isPublic && (
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    Public
                  </Badge>
                )}
              </div>
              {template.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onToggleFavorite}
                className="p-2 hover:bg-muted rounded-md"
              >
                <Star
                  className={`h-4 w-4 ${
                    template.isFavorite ? "fill-yellow-400 text-yellow-400" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {template.schemeName}
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {template.usageCount} uses
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {template.rating.toFixed(1)}
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(template.createdAt)}
            </div>
          </div>

          {/* Tags */}
          {template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Expandable details */}
          {showDetails && (
            <div className="space-y-3 pt-3 border-t">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Premises</h4>
                {Object.entries(template.filledPremises).map(([key, value]) => (
                  <div key={key} className="bg-muted p-2 rounded text-sm">
                    <span className="font-medium text-sky-600">{key}:</span>{" "}
                    {value || <span className="text-muted-foreground italic">Empty</span>}
                  </div>
                ))}
              </div>

              {Object.keys(template.variables).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Variables</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(template.variables).map(([key, value]) => (
                      <Badge key={key} variant="outline">
                        {key}: {value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showDetails ? "Hide" : "Show"} details
              <ChevronDown
                className={`h-3 w-3 transition-transform ${
                  showDetails ? "rotate-180" : ""
                }`}
              />
            </button>

            <div className="flex items-center gap-2">
              {showActions && (
                <>
                  <button
                    onClick={onDuplicate}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Duplicate
                  </button>
                  <button
                    onClick={onDelete}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive/10 hover:text-destructive h-9 px-3"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                </>
              )}
              {onSelect && (
                <button
                  onClick={onSelect}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700 h-9 px-4"
                >
                  Use Template
                </button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Save Template Dialog
// ============================================================================

interface SaveTemplateDialogProps {
  onSave: (template: Partial<SavedTemplate>) => Promise<SavedTemplate | undefined>;
  currentTemplate: {
    schemeId: string;
    schemeName: string;
    filledPremises: Record<string, string>;
    variables: Record<string, string>;
    evidenceLinks: Record<string, string[]>;
  };
}

function SaveTemplateDialog({ onSave, currentTemplate }: SaveTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        tags,
        isPublic,
        schemeId: currentTemplate.schemeId,
        schemeName: currentTemplate.schemeName,
        filledPremises: currentTemplate.filledPremises,
        variables: currentTemplate.variables,
        evidenceLinks: currentTemplate.evidenceLinks,
      });

      // Reset form
      setName("");
      setDescription("");
      setTags([]);
      setIsPublic(false);
      setOpen(false);
    } catch (err) {
      console.error("Failed to save template:", err);
      setError("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  }

  function addTag() {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
          <BookmarkPlus className="h-4 w-4 mr-1" />
          Save as Template
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Argument Template</DialogTitle>
          <DialogDescription>
            Save your current argument as a reusable template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              placeholder="e.g., Expert Opinion on Climate Change"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              placeholder="Describe what this template is useful for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="template-tags"
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button
                onClick={addTag}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="template-public"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="template-public" className="cursor-pointer">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Share with community
              </div>
            </Label>
          </div>

          {/* Preview */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">Template Preview</p>
            <div className="bg-muted p-3 rounded text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-sky-600" />
                <span className="font-medium">{currentTemplate.schemeName}</span>
              </div>
              <div className="text-muted-foreground">
                {Object.keys(currentTemplate.filledPremises).length} premises,{" "}
                {Object.keys(currentTemplate.variables).length} variables
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => setOpen(false)}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-sky-600 text-white hover:bg-sky-700 h-10 px-4"
          >
            {isSaving ? "Saving..." : "Save Template"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ tab }: { tab: string }) {
  return (
    <div className="text-center py-12">
      <Library className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-lg font-medium mb-2">No templates found</p>
      <p className="text-sm text-muted-foreground">
        {tab === "my-templates" && "Start building arguments and save them as templates"}
        {tab === "community" && "No community templates available yet"}
        {tab === "favorites" && "You haven't favorited any templates yet"}
      </p>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString();
}
