// lib/sources/index.ts
// Phase 3.1 & 3.2: Source Infrastructure - Barrel Export

// Phase 3.1: Trust Infrastructure
export * from "./verification";
export * from "./archiving";
export * from "./retractionCheck";
export * from "./alerts";
export * from "./triggers";

// Phase 3.2: Academic Database Integration
export * from "./academicSearch";
export * from "./databases/semanticScholar";
export * from "./databases/openAlex";
export * from "./databases/crossref";

// Phase 3.2: Reference Manager Integration
export * from "./referenceManagers/zotero";
