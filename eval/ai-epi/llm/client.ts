/**
 * BriefingClient — abstraction over "thing that produces a
 * BriefingClaim from a fixture/payload".
 *
 * Why the indirection. The Phase 1 scorecard (`scorecard/phase1.ts`)
 * grades a `BriefingClaim` (the structured fingerprint of what an LLM
 * briefing asserted). To turn that into an end-to-end regression run
 * we need *something* that produces a claim per fixture. Three
 * implementations:
 *
 *   - `MockBriefingClient`: hand-authored, frozen, committed per-fixture
 *     claims. Used by CI. Validates that the scorecard logic itself
 *     stays sound across changes to the harness, and that the captured
 *     corpus stays consistent with its frozen expected output.
 *   - `OpenAIBriefingClient` / `AnthropicBriefingClient`: real LLM
 *     calls. Env-gated. Used in nightly / on-demand. Validates that an
 *     actual model fed the briefing payload produces a structurally
 *     faithful claim.
 *   - Future: any other model adapter, or a deterministic-baseline
 *     client that copies manifest fields straight into a claim (an
 *     "oracle" client that should always pass — useful as an upper
 *     bound).
 *
 * All three implement the same interface so `runRegression.ts` is
 * client-agnostic.
 */

import type { BriefingClaim, Fixture } from "../types";

/**
 * A briefing client. Given a fixture (which includes the
 * `FixtureReadout` an LLM would consume), produce the structured
 * fingerprint of what the briefing asserts.
 *
 * Implementations MUST be deterministic for any given fixture+claim
 * combination iff the underlying mechanism is deterministic. The mock
 * client is deterministic. LLM-backed clients are nondeterministic by
 * nature; that's a known limitation of nightly runs.
 */
export interface BriefingClient {
  /** Human-readable identifier (e.g. "mock", "openai:gpt-4o"). */
  readonly name: string;
  /**
   * Produce a `BriefingClaim` for `fixture`. The fixture's
   * `readout` IS the briefing payload (see `lib/deliberation/briefing.ts`).
   * Implementations should treat the readout as the only source of
   * truth — no DB reads, no extra fetches.
   */
  produceBriefingClaim(fixture: Fixture): Promise<BriefingClaim>;
}
