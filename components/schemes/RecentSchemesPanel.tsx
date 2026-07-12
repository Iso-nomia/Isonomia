/**
 * Recent Schemes Panel
 * 
 * Displays recently viewed schemes with quick access.
 * 
 * Week 8, Task 8.3: User Preferences
 */

"use client";

import React from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, X } from "lucide-react";
import type { ArgumentScheme } from "@prisma/client";
import { useNavigationStore } from "@/lib/schemes/navigation-state";

// Custom scrollbar styles for light mode
export const scrollbarStyles = `
  .custom-scrollbar-light::-webkit-scrollbar {
    width: 3px;
  }
  .custom-scrollbar-light::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
  }
  .custom-scrollbar-light::-webkit-scrollbar-thumb {
    background: rgba(56, 189, 248, 0.4);
    border-radius: 4px;
  }
  .custom-scrollbar-light::-webkit-scrollbar-thumb:hover {
    background: rgba(56, 189, 248, 0.6);
  }
       .custom-scrollbar-short::-webkit-scrollbar {
       width: 3px;
    
    border-radius: 3px;
  }
  .custom-scrollbar-short::-webkit-scrollbar-track {
         width: 3px;
margin-top: 20px;
margin-bottom: 20px;
     background: #5a5a7b6b;
    border-radius: 50px;
  }
  .custom-scrollbar-short::-webkit-scrollbar-thumb {
         width: 3px;

     background: #5d5d6d98;
    border-radius: 50px;
  }
  .custom-scrollbar-short::-webkit-scrollbar-thumb:hover {
         width: 3px;

    background: #7878a3;
  }
`;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface RecentSchemesPanelProps {
  onClose: () => void;
  onSchemeSelect: (scheme: ArgumentScheme) => void;
}

export default function RecentSchemesPanel({
  onClose,
  onSchemeSelect,
}: RecentSchemesPanelProps) {
  const { recentSchemes } = useNavigationStore();
  const { data: allSchemes, isLoading } = useSWR<ArgumentScheme[]>(
    "/api/schemes/all",
    fetcher
  );

  // Filter schemes to only recents
  const schemes = allSchemes?.filter((s) => recentSchemes.includes(s.key)) || [];

  // Sort by recency (maintain order from recentSchemes array)
  const sortedSchemes = schemes.sort((a, b) => {
    return recentSchemes.indexOf(a.key) - recentSchemes.indexOf(b.key);
  });

  return (
    <div className="cardv2 p-0">
              <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
        
    <Card className="p-6  max-h-[80vh] w-96 overflow-y-auto  custom-scrollbar-short">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          <h3 className="text-lg font-bold">Recent Schemes</h3>
          <Badge variant="secondary">{recentSchemes.length}</Badge>
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
          <Clock className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No recent schemes yet. Start exploring to build your history!
          </p>
        </div>
      )}

      {!isLoading && sortedSchemes.length > 0 && (
        <div className="space-y-2">
          {sortedSchemes.map((scheme) => (
            <Card
              key={scheme.id}
              className="p-3 bg-white btnv2--ghost menuv2--lite cursor-pointer transition-colors"
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
            </Card>
          ))}
        </div>
      )}
    </Card>
    </div>
  );
}
