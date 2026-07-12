export type VersionChangeType =
  | "CREATED"
  | "REVISED"
  | "REFINED"
  | "CORRECTED"
  | "RECLASSIFIED";

export interface VersionChainNode<T> {
  id: string;
  versionNumber: number;
  previousId: string | null;
  body: T;
  changeType: VersionChangeType;
  createdAt: Date;
}
