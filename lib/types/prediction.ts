export interface Market {
    id: string;
    yesPool: number;
    noPool: number;
    b: number;
  
    /** dates */
    closesAt?: string | Date;
    closedAt?: string | Date;     // ← add
    resolvesAt?: string | Date;   // ← add
  
    /** state */
    state?: "OPEN" | "CLOSED" | "RESOLVED";
    outcome?: "YES" | "NO" | null;
    canResolve?: boolean;
  }