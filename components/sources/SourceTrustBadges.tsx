// components/sources/SourceTrustBadges.tsx
// Phase 3.1: Combined Source Trust Indicators

"use client";

import React, { useState, useCallback } from "react";
import { VerificationBadge, SourceVerificationStatus } from "./VerificationBadge";
import { ArchiveBadge, ArchiveStatus } from "./ArchiveBadge";
import { cn } from "@/lib/utils";

export interface SourceTrustData {
  id: string;
  verificationStatus: SourceVerificationStatus;
  lastCheckedAt?: Date | string | null;
  canonicalUrl?: string | null;
  archiveStatus: ArchiveStatus;
  archiveUrl?: string | null;
  archivedAt?: Date | string | null;
}

interface SourceTrustBadgesProps {
  source: SourceTrustData;
  showVerification?: boolean;
  showArchive?: boolean;
  compact?: boolean;
  className?: string;
  onUpdate?: (source: SourceTrustData) => void;
}

export function SourceTrustBadges({
  source,
  showVerification = true,
  showArchive = true,
  compact = false,
  className,
  onUpdate,
}: SourceTrustBadgesProps) {
  const [verifying, setVerifying] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [localSource, setLocalSource] = useState(source);

  // Update local state when source prop changes
  React.useEffect(() => {
    setLocalSource(source);
  }, [source]);

  const handleVerifyNow = useCallback(async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/sources/${source.id}/verify`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.source) {
          const updated = {
            ...localSource,
            verificationStatus: data.source.verificationStatus,
            lastCheckedAt: data.source.lastCheckedAt,
            canonicalUrl: data.source.canonicalUrl,
          };
          setLocalSource(updated);
          onUpdate?.(updated);
        }
      }
    } catch (error) {
      console.error("Verification failed:", error);
    } finally {
      setVerifying(false);
    }
  }, [source.id, localSource, onUpdate]);

  const handleRequestArchive = useCallback(async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/sources/${source.id}/archive`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.source) {
          const updated = {
            ...localSource,
            archiveStatus: data.source.archiveStatus,
            archiveUrl: data.source.archiveUrl,
            archivedAt: data.source.archivedAt,
          };
          setLocalSource(updated);
          onUpdate?.(updated);
        }
      }
    } catch (error) {
      console.error("Archiving failed:", error);
    } finally {
      setArchiving(false);
    }
  }, [source.id, localSource, onUpdate]);

  const showBoth = showVerification && showArchive;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {showVerification && (
        <VerificationBadge
          status={localSource.verificationStatus}
          lastCheckedAt={localSource.lastCheckedAt}
          canonicalUrl={localSource.canonicalUrl}
          onVerifyNow={handleVerifyNow}
          loading={verifying}
          compact={compact}
        />
      )}
      {showBoth && (
        <span className="text-muted-foreground/30">·</span>
      )}
      {showArchive && (
        <ArchiveBadge
          status={localSource.archiveStatus}
          archiveUrl={localSource.archiveUrl}
          archivedAt={localSource.archivedAt}
          onRequestArchive={handleRequestArchive}
          loading={archiving}
          compact={compact}
        />
      )}
    </div>
  );
}

export default SourceTrustBadges;
