import useSWR, { mutate as swrMutate } from "swr";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

/**
 * Type for deliberation data response
 */
export type DeliberationData = {
  // Core data
  deliberation: any | undefined;
  works: any[] | undefined;
  claims: any[] | undefined;
  
  // Conditional data (based on selection or tab)
  categoryData: any | undefined;
  
  // Loading states
  isLoading: boolean;
  isDeliberationLoading: boolean;
  isWorksLoading: boolean;
  isClaimsLoading: boolean;
  
  // Error states
  error: any;
  delibError: any;
  worksError: any;
  claimsError: any;
  
  // Actions
  refreshAll: () => void;
  refreshDeliberation: () => void;
  refreshWorks: () => void;
  refreshClaims: () => void;
};

/**
 * Options for data fetching
 */
export type DeliberationDataOptions = {
  /** Whether to fetch category data (depends on selection) */
  fetchCategory?: boolean;
  /** SWR revalidation options */
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  refreshInterval?: number;
};

/**
 * Custom hook for fetching deliberation data
 * 
 * Consolidates multiple SWR calls into a single hook with organized
 * loading states, error handling, and refresh actions.
 * 
 * @example
 * ```tsx
 * const { deliberation, claims, works, isLoading, error, refreshAll } = 
 *   useDeliberationData(deliberationId, {
 *     fetchCategory: !!selection,
 *   });
 * 
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 * 
 * return (
 *   <div>
 *     <h1>{deliberation.title}</h1>
 *     <ClaimsList claims={claims} />
 *     <WorksList works={works} />
 *     <Button onClick={refreshAll}>Refresh</Button>
 *   </div>
 * );
 * ```
 */
export function useDeliberationData(
  deliberationId: string | undefined,
  options: DeliberationDataOptions = {}
): DeliberationData {
  const {
    fetchCategory = false,
    revalidateOnFocus = false,
    revalidateOnReconnect = true,
    refreshInterval = 0,
  } = options;

  // Core data fetching
  const {
    data: deliberation,
    error: delibError,
    isLoading: isDeliberationLoading,
  } = useSWR(
    deliberationId ? `/api/deliberations/${deliberationId}` : null,
    fetcher,
    { revalidateOnFocus, revalidateOnReconnect, refreshInterval }
  );

  const {
    data: works,
    error: worksError,
    isLoading: isWorksLoading,
  } = useSWR(
    deliberationId ? `/api/works?deliberationId=${deliberationId}` : null,
    fetcher,
    { revalidateOnFocus, revalidateOnReconnect }
  );

  const {
    data: claims,
    error: claimsError,
    isLoading: isClaimsLoading,
  } = useSWR(
    deliberationId ? `/api/claims?deliberationId=${deliberationId}` : null,
    fetcher,
    { revalidateOnFocus, revalidateOnReconnect }
  );

  // Conditional data (based on options)
  const { data: categoryData } = useSWR(
    fetchCategory && deliberationId
      ? `/api/deliberations/${deliberationId}/category`
      : null,
    fetcher,
    { revalidateOnFocus, revalidateOnReconnect }
  );

  // Combined loading state
  const isLoading =
    isDeliberationLoading || isWorksLoading || isClaimsLoading;

  // Combined error (first error encountered)
  const error = delibError || worksError || claimsError;

  // Refresh actions
  const refreshDeliberation = () => {
    if (deliberationId) {
      swrMutate(`/api/deliberations/${deliberationId}`);
    }
  };

  const refreshWorks = () => {
    if (deliberationId) {
      swrMutate(`/api/works?deliberationId=${deliberationId}`);
    }
  };

  const refreshClaims = () => {
    if (deliberationId) {
      swrMutate(`/api/claims?deliberationId=${deliberationId}`);
    }
  };

  const refreshAll = () => {
    refreshDeliberation();
    refreshWorks();
    refreshClaims();
    if (fetchCategory && deliberationId) {
      swrMutate(`/api/deliberations/${deliberationId}/category`);
    }
  };

  return {
    // Data
    deliberation,
    works,
    claims,
    categoryData,
    
    // Loading states
    isLoading,
    isDeliberationLoading,
    isWorksLoading,
    isClaimsLoading,
    
    // Error states
    error,
    delibError,
    worksError,
    claimsError,
    
    // Actions
    refreshAll,
    refreshDeliberation,
    refreshWorks,
    refreshClaims,
  };
}
