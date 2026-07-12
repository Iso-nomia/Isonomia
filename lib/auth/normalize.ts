export function asUserIdString(id: unknown): string {
    // Handles string, number, BigInt, null/undefined
    if (id == null) return '';
    try { return String(id); } catch { return ''; }
  }
  