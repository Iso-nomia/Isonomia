/**
 * Ludics Adapters Index
 * 
 * Adapters for converting between:
 * - DialogueMove (application) ↔ DialogueAct (theory)
 * - Prisma models ↔ Runtime theory types
 * - Legacy DDS types ↔ Theory types
 * - DeliberationArena ↔ UniversalArena
 */

export * from "./dialogue-move-adapter";
export * from "./prisma-adapter";
export * from "./legacy-adapter";
export * from "./arena-adapter";
