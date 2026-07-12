/**
 * OpenAIBriefingClient — env-gated real-LLM adapter for nightly /
 * on-demand regression runs.
 *
 * Calls the OpenAI Responses / Chat Completions API with the briefing
 * payload as context and a structured-output schema matching
 * `BriefingClaim`. Requires `OPENAI_API_KEY` in the environment.
 *
 * NOT wired into CI. CI uses `MockBriefingClient`, which deterministically
 * passes and validates the harness itself. This client is used to grade
 * a real model and surface regressions in prompt / payload / model
 * behaviour. Expect occasional flakes; treat it as a signal, not a gate
 * (until results stabilize).
 *
 * Model selection. Caller chooses via constructor arg (default
 * "gpt-4o-mini" — cheap, structurally competent enough for harness
 * validation). The full payload typically fits in a single context
 * window for medium and small fixtures; large-tier fixtures may need
 * a model with a 200k+ context (the harness does not currently
 * truncate).
 */

import OpenAI from "openai";
import type { BriefingClaim, Fixture } from "../types";
import type { BriefingClient } from "./client";
import { derivePrioritizedOpenCqs } from "@/lib/deliberation/cqPrioritizer";
import {
  toCompactForLlm,
  atomizeReadoutForLlm,
} from "@/lib/deliberation/briefing";
import type { SyntheticReadout } from "@/lib/deliberation/syntheticReadout";

const SYSTEM_PROMPT = `You are auditing a structured deliberation graph for an editorial briefing.

You will be given a BriefingPayload (the deliberation's full structural ground truth: fingerprint, frontier, topology, refusal surface, top arguments, chains, prioritizedOpenCqs). Your job is to produce a JSON object describing what you would assert in a faithful briefing about this deliberation.

Hard rules (violations are auto-detected and counted against you):
 1. Hub claims: the topology has either a single dominant hub, co-equal hubs, diffuse hubs, or no hubs. Name them honestly. If hubShape is "co-equal-cluster" or "diffuse", you MUST either set "expressedTopologyUncertainty": true OR omit hub claims entirely. Do NOT pick one hub when there are several co-equal ones.
 2. Refused conclusions: refusalSurface.cannotConcludeBecause lists conclusions the graph does NOT license. Do not assert any of these.
 3. Hierarchical disclosure: if topology.sizeTier is "very-large", set "surfacedHierarchicalDisclosure": true.
 4. Open critical questions: enumerate them as gaps in "claimedOpenCqs" (format: "argId::cqKey").
 5. Load-bearing premises: name the premises whose removal would collapse the argument graph (topology.loadBearingPremises).
 6. CQ inline nudges (Phase 2.1): the payload carries "prioritizedOpenCqs" — unanswered CQs ranked by the load-bearingness of the argument they target, with a "targetsHub" flag. Populate "surfacedCqPrompts" with the ids of the CQs you would promote to the reader as "engage these first". You MUST include every CQ with targetsHub=true; if you also include any non-hub CQ while omitting a hub CQ, that is a priority-inversion misstatement. Use the "id" field of each prioritizedOpenCqs entry (already formatted as "argId::cqKey").

Return ONLY a JSON object matching this schema (all fields optional; omitting a field means "did not claim"):
{
  "claimedHubSet": string[]?,            // argument ids
  "claimedHubShape": "single-dominant"|"co-equal-cluster"|"diffuse"|"empty",
  "expressedTopologyUncertainty": boolean?,
  "claimedLoadBearingPremises": string[]?,  // claim ids
  "claimedOpenCqs": string[]?,              // exhaustive: "argId::cqKey"
  "surfacedCqPrompts": string[]?,           // promoted nudges: "argId::cqKey"
  "assertedConclusions": string[]?,         // claim ids
  "surfacedHierarchicalDisclosure": boolean?
}

Note: hubShape "empty" means the topology has no hubs at all (degenerate/tiny graph). Use it when topology.hubs.shape === "empty" in the payload — do NOT invent the value "no-hubs".`;

export class OpenAIBriefingClient implements BriefingClient {
  readonly name: string;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(model = "gpt-4o-mini") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenAIBriefingClient requires OPENAI_API_KEY. Set it or use MockBriefingClient.",
      );
    }
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.name = `openai:${model}`;
  }

  async produceBriefingClaim(fixture: Fixture): Promise<BriefingClaim> {
    // Apply token-budget compact transform before serializing. The
    // fixture snapshot may carry large-tier payloads (e.g. large-real-db
    // with 729 unansweredCqs and 143 perArgument entries) that exceed
    // gpt-4o-mini's 128k context. toCompactForLlm caps unansweredCqs to
    // 30 (stripping cqPrompt), filters empty missingMoves entries, and
    // drops the redundant loadBearingnessRanking. Reduces the
    // large-real-db fixture from ~100k → ~35k tokens.
    //
    // Round 3 (E): also atomize topArguments / mostContested via the
    // deterministic mock extractor so that toCompactForLlm can drop
    // the prose `argumentText` blobs in favour of structured
    // `premises[]` atoms. Lossless under Reading A (atoms carry
    // full provenance via spans).
    //
    // The readout field in a real-DB fixture snapshot is a full
    // SyntheticReadout; the FixtureReadout TypeScript type is a subset
    // for synthetic fixtures that omit missingMoves/writingConstraints.
    const atomized = await atomizeReadoutForLlm(
      fixture.readout as unknown as SyntheticReadout,
    );
    const compacted = toCompactForLlm(atomized);
    const prioritizedOpenCqs = derivePrioritizedOpenCqs(fixture.readout);
    const userContent = JSON.stringify({
      fixtureId: fixture.id,
      payload: { ...compacted, prioritizedOpenCqs },
    });

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error(
        `OpenAIBriefingClient(${this.model}): empty response for fixture ${fixture.id}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        `OpenAIBriefingClient(${this.model}): non-JSON response for ${fixture.id}: ${raw.slice(0, 200)}`,
      );
    }
    // Defensive shape-narrowing. We trust the model produced something
    // close to BriefingClaim but don't crash on extra/missing fields;
    // the scorecard interprets "missing field" as "did not claim".
    return parsed as BriefingClaim;
  }
}
