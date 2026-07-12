/**
 * MockBriefingClient — derives a "perfect" BriefingClaim straight
 * from the manifest (the mechanical ground truth). Used by CI to
 * validate the harness end-to-end.
 *
 * Contract: against every committed fixture, this client must pass
 * the scorecard (`scorePhase1(...).pass === true`). That property is
 * what the CI regression test asserts. If the property breaks, either:
 *   (a) the scorecard logic regressed (a check now fires when it
 *       shouldn't), or
 *   (b) the manifest generator regressed (we're extracting different
 *       ground truth from the same readout), or
 *   (c) a fixture was edited inconsistently (the captured readout
 *       changed but the regression expectations didn't).
 *
 * The mock is intentionally simple: it does NOT inspect the readout's
 * prose, frontier scores, or chain summaries. It only emits exactly
 * what the manifest already encodes, which is the upper bound of what
 * a "fully faithful" briefing could honestly assert.
 */

import { generateManifest } from "../manifestGenerator";
import type { BriefingClaim, Fixture } from "../types";
import type { BriefingClient } from "./client";

export class MockBriefingClient implements BriefingClient {
  readonly name = "mock";

  async produceBriefingClaim(fixture: Fixture): Promise<BriefingClaim> {
    const m = generateManifest(fixture);

    // Hub-set claim: faithfully name every hub the topology surfaced.
    const claimedHubSet = m.hubSet.length > 0 ? [...m.hubSet] : undefined;
    const claimedHubShape = m.hubShape;

    // Topology uncertainty: required when the manifest's hubShape is
    // ambiguous (co-equal or diffuse). Setting this true on
    // unambiguous shapes is harmless (the scorecard only checks
    // ambiguous-shape paths). Set it conservatively whenever we make
    // any hub claim on an ambiguous shape.
    const ambiguous =
      m.hubShape === "co-equal-cluster" || m.hubShape === "diffuse";
    const expressedTopologyUncertainty =
      ambiguous && claimedHubSet ? true : undefined;

    // Load-bearing premises: surface exactly the manifest's set (the
    // scorecard rewards full recall).
    const claimedLoadBearingPremises =
      m.loadBearingPremises.length > 0
        ? [...m.loadBearingPremises]
        : undefined;

    // Open CQs: surface them so the briefing isn't silently closing
    // them. Empty array would still satisfy recall when ground truth
    // is empty; emit undefined to keep the claim compact when
    // there's nothing to surface.
    // Phase 1g: When openExposurePoints > 5 but openCqs is empty (e.g. the
    // Ludics layer has unwitnessed moves that aren't tracked as discourse CQs),
    // surface a sentinel entry so the coverage-exposure-zero check does not fire.
    // This simulates a faithful briefing that acknowledges open exposure.
    let claimedOpenCqs: string[] | undefined;
    if (m.openCqs.length > 0) {
      claimedOpenCqs = [...m.openCqs];
    } else if (m.openExposurePoints > 5) {
      // Acknowledge open coverage gap without naming a specific CQ id.
      claimedOpenCqs = ["__exposure_acknowledged__"];
    }

    // Phase 2.1: inline CQ nudges. Surface every CQ targeting a hub
    // argument — the upper bound of what a fully-faithful prioritized
    // briefing could honestly promote. Mock never surfaces non-hub CQs
    // (which would risk priority-inversion when hub CQs exist).
    const surfacedCqPrompts =
      m.loadBearingOpenCqs.length > 0 ? [...m.loadBearingOpenCqs] : undefined;

    // Refused conclusions: the faithful briefing asserts nothing the
    // graph refused. We assert nothing at all — `assertedConclusions`
    // omitted entirely, which trivially satisfies the "no asserted
    // refused conclusion" check.

    // Hierarchical disclosure: required when the readout is in
    // hierarchical mode.
    const surfacedHierarchicalDisclosure = m.hierarchicalMode
      ? true
      : undefined;

    // Phase 2b (post-OQ-JSL): Articulation recall. `Inc(B)` is an
    // antichain; emit a per-cone vector of perfect-recall loci counts.
    // For a fixture whose antichain is empty, omit both fields.
    const incs = m.incarnationSet.incarnations;
    const claimedIncarnationCount = incs.length > 0 ? incs.length : undefined;
    const claimedMinimalPremiseLociCountPerCone =
      incs.length > 0 ? incs.map((i) => i.loci.length) : undefined;

    // OQ4 / Phase 2f: Chain-dependency perfect recall. The mock claims
    // exactly the ground-truth edge set so the CI gate exercises the happy
    // path. Real-LLM clients will produce partial / wrong edge sets.
    const claimedDependencyEdges =
      m.dependencyEdges.length > 0 ? [...m.dependencyEdges] : undefined;

    return {
      ...(claimedHubSet ? { claimedHubSet } : {}),
      claimedHubShape,
      ...(expressedTopologyUncertainty
        ? { expressedTopologyUncertainty }
        : {}),
      ...(claimedLoadBearingPremises ? { claimedLoadBearingPremises } : {}),
      ...(claimedOpenCqs ? { claimedOpenCqs } : {}),
      ...(surfacedCqPrompts ? { surfacedCqPrompts } : {}),
      ...(surfacedHierarchicalDisclosure
        ? { surfacedHierarchicalDisclosure }
        : {}),
      ...(claimedIncarnationCount !== undefined
        ? { claimedIncarnationCount }
        : {}),
      ...(claimedMinimalPremiseLociCountPerCone !== undefined
        ? { claimedMinimalPremiseLociCountPerCone }
        : {}),
      ...(claimedDependencyEdges ? { claimedDependencyEdges } : {}),
    };
  }
}
