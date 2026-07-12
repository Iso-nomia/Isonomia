// hooks/useSourceTrust.ts
// Phase 3.1: Hook for source verification and archiving

import { useState, useCallback } from "react";

// Define types locally to avoid Prisma client cache issues
export type SourceVerificationStatus = 
  | "unverified"
  | "verified"
  | "redirected"
  | "unavailable"
  | "broken"
  | "paywalled";

export type ArchiveStatus =
  | "none"
  | "pending"
  | "in_progress"
  | "archived"
  | "failed"
  | "exists";

export interface SourceTrustState {
  verificationStatus: SourceVerificationStatus;
  lastCheckedAt: Date | null;
  canonicalUrl: string | null;
  httpStatus: number | null;
  archiveStatus: ArchiveStatus;
  archiveUrl: string | null;
  archivedAt: Date | null;
}

export function useSourceTrust(sourceId: string) {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SourceTrustState | null>(null);

  /**
   * Fetch current verification and archive status
   */
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [verifyRes, archiveRes] = await Promise.all([
        fetch(`/api/sources/${sourceId}/verify`),
        fetch(`/api/sources/${sourceId}/archive`),
      ]);

      const verifyData = verifyRes.ok ? await verifyRes.json() : null;
      const archiveData = archiveRes.ok ? await archiveRes.json() : null;

      if (verifyData?.source || archiveData?.source) {
        setState({
          verificationStatus:
            verifyData?.source?.verificationStatus || "unverified",
          lastCheckedAt: verifyData?.source?.lastCheckedAt || null,
          canonicalUrl: verifyData?.source?.canonicalUrl || null,
          httpStatus: verifyData?.source?.httpStatus || null,
          archiveStatus: archiveData?.source?.archiveStatus || "none",
          archiveUrl: archiveData?.source?.archiveUrl || null,
          archivedAt: archiveData?.source?.archivedAt || null,
        });
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  /**
   * Trigger source verification
   */
  const verify = useCallback(async () => {
    setVerifying(true);
    setError(null);

    try {
      const res = await fetch(`/api/sources/${sourceId}/verify`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Verification failed");
      }

      const data = await res.json();
      if (data.source) {
        setState((prev) => ({
          ...prev!,
          verificationStatus: data.source.verificationStatus,
          lastCheckedAt: data.source.lastCheckedAt,
          canonicalUrl: data.source.canonicalUrl,
          httpStatus: data.source.httpStatus,
        }));
      }

      return data;
    } catch (err) {
      setError(String(err));
      throw err;
    } finally {
      setVerifying(false);
    }
  }, [sourceId]);

  /**
   * Request source archiving
   */
  const archive = useCallback(async () => {
    setArchiving(true);
    setError(null);

    try {
      const res = await fetch(`/api/sources/${sourceId}/archive`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Archiving failed");
      }

      const data = await res.json();
      if (data.source) {
        setState((prev) => ({
          ...prev!,
          archiveStatus: data.source.archiveStatus,
          archiveUrl: data.source.archiveUrl,
          archivedAt: data.source.archivedAt,
        }));
      }

      return data;
    } catch (err) {
      setError(String(err));
      throw err;
    } finally {
      setArchiving(false);
    }
  }, [sourceId]);

  return {
    state,
    loading,
    verifying,
    archiving,
    error,
    fetchStatus,
    verify,
    archive,
  };
}

export default useSourceTrust;
