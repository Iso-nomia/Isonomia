/**
 * Favorites Panel
 * 
 * Displays user's favorite schemes with management options.
 * 
 * Week 8, Task 8.3: User Preferences
 */

"use client";

import React from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, X } from "lucide-react";
import type { ArgumentScheme } from "@prisma/client";
import { useNavigationStore } from "@/lib/schemes/navigation-state";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface FavoritesPanelProps {
  onClose: () => void;
  onSchemeSelect: (scheme: ArgumentScheme) => void;
}

export default function FavoritesPanel({
  onClose,
  onSchemeSelect,
}: FavoritesPanelProps) {
  const { favoriteSchemeKeys, toggleFavorite } = useNavigationStore();
  const { data: allSchemes, isLoading } = useSWR<ArgumentScheme[]>(
    "/api/schemes/all",
    fetcher
  );

  // Filter schemes to only favorites
  const favoriteSchemes =
    allSchemes?.filter((s) => favoriteSchemeKeys.includes(s.key)) || [];

  // Sort alphabetically
  const sortedSchemes = favoriteSchemes.sort((a, b) =>
    (a.name || "").localeCompare(b.name || "")
  );

  return (
    <Card className="cardv2 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
          <h3 className="text-lg font-bold">Favorite Schemes</h3>
          <Badge variant="secondary">{favoriteSchemeKeys.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-3 border-primary border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      )}

      {!isLoading && sortedSchemes.length === 0 && (
        <div className="text-center py-8">
          <Star className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No favorites yet. Click the star icon on schemes to save them here!
          </p>
        </div>
      )}

      {!isLoading && sortedSchemes.length > 0 && (
        <div className="space-y-2">
          {sortedSchemes.map((scheme) => (
            <Card
              key={scheme.id}
             
              className=" bg-white btnv2--ghost menuv2--lite px-3 py-3 rounded-xl"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    onSchemeSelect(scheme);
                    onClose();
                  }}
                >
                  <h4 className="font-medium text-sm">{scheme.name}</h4>
                  {scheme.summary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {scheme.summary}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(scheme.key);
                  }}
                  className="shrink-0"
                >
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}
