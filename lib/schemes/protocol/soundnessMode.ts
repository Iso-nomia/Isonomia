// lib/schemes/protocol/soundnessMode.ts
//
// Phase 4 / Spec 3 §5 feature-flag: controls whether the close-hook
// runs in `off`, `warn`, or `block` mode. Read from env once at
// import time; can be overridden in tests via `__setSoundnessModeForTests`.

export type SoundnessMode = "off" | "warn" | "block";

const VALID_MODES: ReadonlySet<SoundnessMode> = new Set(["off", "warn", "block"]);

function parseMode(raw: string | undefined): SoundnessMode {
  const v = (raw ?? "warn").toLowerCase();
  return VALID_MODES.has(v as SoundnessMode) ? (v as SoundnessMode) : "warn";
}

let currentMode: SoundnessMode = parseMode(process.env.MESH_SCHEME_SOUNDNESS_MODE);

export function getSoundnessMode(): SoundnessMode {
  return currentMode;
}

/** Test-only. Production should set MESH_SCHEME_SOUNDNESS_MODE in env. */
export function __setSoundnessModeForTests(mode: SoundnessMode): void {
  currentMode = mode;
}
