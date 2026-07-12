/**
 * orientation.ts — Server-level instructions block + `get_orientation`
 * tool payload for the Isonomia MCP server.
 *
 * Why this exists:
 *   The MCP tool descriptions are accurate per-tool but silent on the
 *   framework. Cold-start agents (Claude eval, May 2026) had to
 *   reverse-engineer `standing`, `MOID`, `refusalSurface`, `chain`,
 *   depth tiers from field names. This module fixes that by:
 *
 *     1. SERVER_INSTRUCTIONS — short ontology + workflow pointer,
 *        loaded once per session via MCP `InitializeResult.instructions`.
 *     2. ORIENTATION_PAYLOAD — long-form glossary + workflow recipes,
 *        returned by the `get_orientation` tool only when called.
 *
 * Both are pragmatic (what do I do with this data?) rather than
 * theoretical (why is the data structured this way?). No argumentation-
 * theory background; every term is defined by its writing-time
 * implications.
 *
 * Versioning: ORIENTATION_VERSION bumps when the payload changes so
 * clients can cache it across sessions without re-reading.
 */

/**
 * Bump when ORIENTATION_PAYLOAD changes. Returned alongside the payload
 * as `version`; agents can hash + cache against this.
 */
export const ORIENTATION_VERSION = "1.21.0" as const;

/**
 * Loaded once per MCP session via `InitializeResult.instructions`.
 * Target: ~400 tokens. Keep tight; the long form lives in
 * ORIENTATION_PAYLOAD.
 */
export const SERVER_INSTRUCTIONS = `Isonomia exposes a deliberation as a typed argument graph.

ONTOLOGY (read once):
A deliberation contains arguments. Each argument has a conclusion (a claim, identified by content-derived MOID — multiple arguments can share one), one or more premises, and an argumentation scheme (the reasoning pattern: expert-opinion, analogy, cause-to-effect, IBE, etc.). Arguments connect via typed edges: support, rebut (attack the conclusion), undercut (attack the inference), undermine (attack a premise). Each argument carries a STANDING that progresses untested-default → untested-supported → tested-attacked → tested-undermined → tested-survived, and a depth tier (thin / moderate / dense) recording how many independent challengers have engaged. Standing without depth is unreliable: "tested-undermined by 1 thin challenger" ≠ "tested-undermined by 10 dense ones". Each scheme has CRITICAL QUESTIONS the literature requires for the scheme to hold; unanswered CQs are tracked per argument. CHAINS are editor-curated paths through the graph (premises → conclusion); chainStanding is worst-link, not average. The REFUSAL SURFACE lists conclusions the graph cannot currently license because of unanswered attacks; entries are hard constraints, not suggestions.

TOOL SELECTION:
Use IDs correctly — \`get_argument\` takes an argument id, \`find_counterarguments\` takes a claim MOID. They are not interchangeable.

WORKFLOW:
For any deliberation question, call \`get_orientation\` once at session start, then \`get_synthetic_readout\` once per deliberation. Read its \`writingConstraints\` before composing output — it tells you what you must include, what you must not assert, and what you must hedge. Drill into specific arguments with \`get_argument\` and specific claims with \`find_counterarguments\` only after orientation.

WRITING TO THE GRAPH (these tools commit rows; treat as first-class, not as fallback):
Whenever the user states a position, asks you to "record / log / capture / save / register" a claim or counter-claim, drafts a thesis, or sketches an evidence-backed argument, reach for a write tool instead of replying in prose. Three write surfaces:
  • \`propose_argument\` — bare assertion. \`{ claim, reasoning?, evidence?[], deliberationId? }\`. Use only when the user has a one-line claim with no premises worth naming.
  • \`propose_structured_argument\` — PREFER THIS whenever the user gives reasons ("because…", "since…"), names an argumentation pattern (expert opinion, analogy, cause-to-effect, practical reasoning), or expects per-premise standing/CQs. \`{ conclusion, premises[], reasoning?, schemeKey?, evidence?[], deliberationId? }\`. Each premise becomes its own Claim row, so attackers can later undermine specific premises rather than the whole argument. If unsure which scheme applies, call \`list_schemes\` first; or omit \`schemeKey\` and the server will infer one (returned as a \`scheme_inferred\` warning).
  • \`propose_argument_chain\` — USE FOR MULTI-STEP REASONING ("A, therefore B; and B, therefore C") rather than several disconnected structured-argument calls. \`{ name, links[], mode?, deliberationId? }\`. Mints 2–12 links (\`mode='mint-and-link'\`) or chains existing arguments by id (\`mode='compose'\`), wiring each link's conclusion claim into the next link's premise (thread by \`reuseClaimId\` from the prior link's \`conclusionClaimId\`, or repeat the exact text to thread by content hash). The SAME health gate runs PER LINK and one bad link rolls back the whole chain. Returns the worst-link \`chainStanding\` — a chain is only as citable as its weakest link.
HEALTH-SELECTION GATE (honesty, write-time): the server only writes against a *healthy argument pattern*. Prefer \`list_schemes(excludeUnhealthy: true)\` so you never pick a dialogue-meta / test-placeholder row — those are REFUSED with \`code: "SCHEME_NOT_ARGUMENT_PATTERN"\` (nothing written). A folksonomy-duplicate key is auto-redirected to its canonical sibling with a \`SCHEME_CANONICALIZED\` warning (never a silent merge; the warning's \`canonical\` field is the key the argument actually attached to). Typed write codes carry a \`canonical\` corrected value: errors \`SCHEME_UNKNOWN\` / \`SCHEME_NOT_ARGUMENT_PATTERN\`; warnings \`SCHEME_CANONICALIZED\`, \`EPISTEMIC_MODE_CHANGED_FINGERPRINT\`, \`VERIFIER_INCONCLUSIVE\`.
Both tools return a permalink + immutable content-addressed URL. Omit \`deliberationId\` to land in the caller's "My Arguments" room; pass one to land in a specific debate. For warrants/inference-licenses against an existing argument, use \`propose_warrant\`. After any write, call \`get_argument\` on the returned id (after \`retryAfterMs\` if \`provenancePending\` is true) to verify the round-trip before claiming success. Do not invent ids or permalinks — only echo what the write tool returned.
ANSWERING CRITICAL QUESTIONS: \`answer_critical_question\` discharges a scheme's open dialectical obligations on an existing argument — call it whenever a \`get_argument\` card shows entries under \`criticalQuestions.unanswered[]\` (\`criticalQuestions\` is a single aggregate object holding \`answered[]\`/\`partiallyAnswered[]\`/\`unanswered[]\`). Pass the SAME \`sessionId\` you used to create the argument and your answer self-canonicalises (promotes straight to CANONICAL, CQ → SATISFIED) in one transaction; answering with a different/absent session, or answering someone else's (or a human-authored) argument, records a PENDING proposal a human approves (non-fatal \`CQ_SELF_CANONICAL_DENIED\` warning). Reuse one UUIDv4 as your \`sessionId\` across every write this session — see Recipe E.4.
CHALLENGING ANSWERED CRITICAL QUESTIONS: \`challenge_critical_question\` is the dual — it RE-OPENS a CQ that already has a canonical answer. Call it when a \`get_argument\` card shows an entry under \`criticalQuestions.answered[]\` whose answer you dispute. Pick an \`attackType\` (REBUT the conclusion / UNDERMINE a premise or its evidence / UNDERCUT the inference; UNDERMINE and challenger-burden CQs must cite evidence) and it files an objection claim + a typed attack edge and flips the CQ SATISFIED → DISPUTED. There is NO self-canonical floor — any caller, the original author included, files on equal footing (no sessionId needed). See Recipe E.5.

TOOL-CLUSTER MAP (66 tools / 7 clusters — route here before scanning tool descriptions):
  1. Session start: \`get_orientation\` (full glossary + recipes), \`get_capabilities\` (cheap auth/identity probe — no round-trip).
  2. Retrieval: \`search_arguments\`, \`get_argument\`, \`get_claim\`, \`get_claim_stances\`, \`find_counterarguments\`, \`cite_argument\`, \`resolve_citation\`, \`resolve_citations_bulk\`.
  3. Authoring/WRITE: \`propose_argument\`, \`propose_structured_argument\`, \`propose_argument_chain\` (multi-step reasoning → a serial chain), \`propose_warrant\`, \`answer_critical_question\` (discharge an argument's open critical questions; \`sessionId\` self-canonicalises — see above), \`challenge_critical_question\` (RE-OPEN an answered CQ via a typed attack; flips SATISFIED → DISPUTED — see above).
  4. Deliberation synthesis: \`get_synthetic_readout\` (primary), \`get_deliberation_fingerprint\`, \`get_contested_frontier\`, \`get_missing_moves\`, \`get_chains\`, \`get_cross_context\`, \`summarize_debate\`, \`get_deliberation_evidence_context\`.
  5. Algebraic/ECC: \`ecc_arrow\`, \`ecc_culprits\`, \`ecc_confidence\`, \`ecc_enthymemes\`, \`ecc_transport\`, \`ecc_aggregate\`, \`ecc_evidential\`, \`ecc_belief_revision_proposals\`; scheme catalog + analysis: \`list_schemes\` (browse; pass \`excludeUnhealthy: true\` before writing), \`verify_scheme_equality\`, \`compute_scheme_fingerprint\`, \`find_behaviourally_similar_schemes\`, \`get_scheme_provenance\`, \`compare_scheme_provenance\`.
  7. Dialectic moves (attacks + protocol dialogue — use to CHALLENGE or DEFEND arguments, not just state them): reads \`get_legal_moves\` (what moves are legal on a target right now — call before moving), \`get_legal_attacks\` (attack-shape cues for some text), \`get_commitments\` (per-participant commitment ledger — read before a CONCEDE). Durable graph attack \`attack_argument\` (freestanding REBUT/UNDERCUT/UNDERMINE — lands PROPOSED pending a HUMAN sign-off under a gating policy, so it is "filed", never "won"). Protocol moves \`post_dialogue_move\` (WHY/GROUNDS/CONCEDE/RETRACT/CLOSE/ACCEPT_ARGUMENT, legal-move gated — an illegal move returns a structured R-code, not an exception), and the two high-value wrappers \`challenge_argument\` (→ WHY, to disagree) and \`respond_to_challenge\` (→ GROUNDS, to defend). Pass a stable \`speakAs\` per side (e.g. "proponent"/"opponent") to occupy a distinct dialogical side — required to legally challenge your OWN argument or for two sessions to take opposite sides; it can never impersonate a human, and you must not spin up personae to fake agreement. See Recipe I. Maintenance \`compile_deliberation\` (force-refresh the DERIVED ludics/AIF view after MCP moves — those are record-only; the compiled layer is refreshed lazily by a background worker, so call this only when you need \`get_synthetic_readout\` / a Cluster-6 panel to reflect your moves RIGHT NOW; slow, rate-limited 6/h, do not poll).
  6. Ludics generative substrate (only when the user mentions locus / design / behaviour / incarnation / cone / witness / articulation lattice / daimon / bind / synthesis): reads \`get_deliberation_schema\` (START HERE), \`list_behaviours\` (enumerate behaviours before probing loci), \`get_behaviour_at_locus\`, \`get_exposure_map\`; lattice algebra \`get_articulation_lattice\`, \`find_minimal_incarnations\`, \`find_equivalent_articulations\`, \`find_substitute_premises\`, \`compress_articulation\`, \`compute_articulation_join\`; witness reads \`get_witnesses\`, \`get_unwitnessed_exposure\`, \`get_instantiation\`, \`get_fossil_record\`; helpers/writes \`list_bindable_moves\` (CALL BEFORE BIND — pre-pairs ludicMoveId + dialogueMoveId + canonicalText), \`bind_participant_to_design\` (iota seam — only path that mints WitnessRecord), \`propose_synthesis\` (Art(B) join write seam). Ludics rules: Inc(B) is an antichain — there is NO global bottom of a behaviour, only per-cone minima; cones are disjoint (cross-cone joins/meets return \`cross-cone-rejected\` — that's a value, not an error); never hand-build \`canonicalText\` (copy verbatim from \`list_bindable_moves\`); never echo \`participantId\` back to the user (T4 non-attribution). For the full Ludics workflow recipes (explore-layer / bind-participant) and glossary, call \`get_orientation\`.`;

/**
 * Returned by the `get_orientation` tool. Markdown-formatted for direct
 * model consumption. Target: ~1.5K tokens.
 */
export const ORIENTATION_PAYLOAD = `# Isonomia Agent Orientation

Version: ${ORIENTATION_VERSION}

## Tool clusters — route here first

66 tools across 7 clusters. Use this map before scanning individual tool descriptions. For a cheap runtime probe of auth / identity / orientation hash without re-reading this payload, call \`get_capabilities\`.

### Cluster 1 — Session start (1 tool)
- \`get_orientation\` — you are reading its output. Call once per session; cache against \`contentHash\`.

### Cluster 2 — Argument retrieval (8 tools)
Use when finding, fetching, or citing specific arguments or claims.
- \`search_arguments\` — free-text search across the graph (ranked by dialectical fitness)
- \`get_argument\` — fetch one argument by id (full: premises, evidence, standing, CQs)
- \`get_claim\` — fetch one claim by MOID (conclusion text, stance count)
- \`get_claim_stances\` — who holds a stance on a claim, scoped to a deliberation
- \`find_counterarguments\` — attacks registered against a claim MOID
- \`cite_argument\` — permalink → structured argument data
- \`resolve_citation\` — DOI/arXiv/URL → canonical citation record (call before \`propose_*\`)
- \`resolve_citations_bulk\` — batch version of \`resolve_citation\`

### Cluster 3 — Argument authoring / WRITE surface (6 tools)
Use when the user wants to record, log, register, or save a position.
- \`propose_argument\` — bare assertion (one-line claim, no explicit premises)
- \`propose_structured_argument\` — **PREFER.** Premise-typed, scheme-annotated, evidence-attached. Enables per-premise standing + CQ tracking.
- \`propose_argument_chain\` — **multi-step reasoning** ("A, therefore B; B, therefore C"). Mints a serial chain of structured-argument links (or composes existing arguments by id), threading each link's conclusion claim into the next link's premise. Same per-link health gate; returns the worst-link \`chainStanding\`. Optionally branches (\`edges[]\` → CONVERGENT/DIVERGENT/TREE/GRAPH), objects (\`attacksNode\`/\`attacksEdge\`), reasons under suppositions (\`scopes[]\`), and carries executable evidence anchors — see E.3. → verify with \`get_chains\`.
- \`propose_warrant\` — attach an inference-license warrant to an existing argument.
- \`answer_critical_question\` — discharge a scheme's open **critical question** on an existing argument. Read the target CQ from \`get_argument.criticalQuestions.unanswered[]\` (\`criticalQuestions\` is a single aggregate object); pass the SAME \`sessionId\` you used to author the argument to self-canonicalise (CQ → SATISFIED) or land a PENDING proposal otherwise. See E.4.
- \`challenge_critical_question\` — the **dual** of answering: RE-OPEN an already-answered CQ you dispute. Read the target from \`get_argument.criticalQuestions.answered[]\`; pick an \`attackType\` (REBUT / UNDERMINE / UNDERCUT — UNDERMINE and challenger-burden CQs must cite evidence) and it files an objection claim + typed attack edge and flips the CQ SATISFIED → DISPUTED. No self-canonical floor — any caller files on equal footing. See E.5.

### Cluster 4 — Deliberation synthesis (8 tools)
Use when working with a whole deliberation room, not individual arguments.
- \`get_synthetic_readout\` — **PRIMARY.** Full synthesis: fingerprint + frontier + topology + refusal surface + top arguments + writing constraints. Start here for any deliberation question.
- \`get_deliberation_fingerprint\` — lightweight freshness check (contentHash only; no synthesis)
- \`get_contested_frontier\` — open challenges (projects onto \`get_synthetic_readout.frontier\`)
- \`get_missing_moves\` — catalog gaps (projects onto \`get_synthetic_readout.missingMoves\`)
- \`get_chains\` — editor-curated traversal paths through the argument graph
- \`get_cross_context\` — cross-deliberation canonical-claim families
- \`summarize_debate\` — NLP-generated summary paragraph (unstructured; prefer \`get_synthetic_readout\` when structure matters)
- \`get_deliberation_evidence_context\` — evidence rollup for a deliberation

### Cluster 5 — Algebraic / ECC tools — Ambler-style derivation checking (8 tools)
Use when auditing the inferential structure of a specific argument or warrant. These tools operate on the closed-category derivation algebra, not on the deliberation graph directly.
- \`ecc_arrow\` — check whether a derivation arrow is valid at the given confidence tier
- \`ecc_culprits\` — find which assumption sets drive a derivation's confidence level
- \`ecc_confidence\` — compute the overall confidence level for a derivation
- \`ecc_enthymemes\` — surface implicit premises (what must be true for the inference to hold)
- \`ecc_transport\` — check whether an argument transports to a new evidential context
- \`ecc_aggregate\` — aggregate multiple derivations into a combined confidence score
- \`ecc_evidential\` — evidential closure: what can be derived from a given evidence set
- \`ecc_belief_revision_proposals\` — what would have to be retracted to block a conclusion

### Scheme catalog + analysis (6 tools)
Browse the argumentation-scheme catalog and reason about scheme identity / redundancy / provenance. The catalogue is a *folksonomy converging on an ontology* (P3/Q-021): there is NO canonical form, so a shared behaviour-fingerprint is only a NECESSARY pre-filter — \`verify_scheme_equality\` is the authoritative arbiter.
- \`list_schemes\` — browse the catalog. Filter by \`clusterTag\` (expert | causal | practical | analogical | …). **Pass \`excludeUnhealthy: true\` before \`propose_structured_argument\`** so you never pick a dialogue-meta or test-placeholder row (the write surface refuses those).
- \`verify_scheme_equality\` — AUTHORITATIVE behaviour-equality verdict between two scheme keys: \`equal\` | \`subset\` | \`incomparable\` | \`inconclusive\`. \`inconclusive\` means the verifier hit its search bound — treat as 'unknown', NOT as 'incomparable'. \`fingerprintsMatched: true\` is necessary-but-not-sufficient for \`equal\`.
- \`compute_scheme_fingerprint\` — the behaviour fingerprint of one scheme (cheap structural pre-filter / bucket key). \`materialised: false\` means recomputed on the fly. Two schemes sharing a fingerprint are equality CANDIDATES to confirm with \`verify_scheme_equality\`.
- \`find_behaviourally_similar_schemes\` — the REDUNDANCY RADAR: fingerprint-bucket then verifier-confirm. Empty \`hits\` means 'no behavioural near-duplicate found', not 'not checked'. Call before authoring/importing a scheme to avoid creating a folksonomy duplicate.
- \`get_scheme_provenance\` — source-of-record for a scheme: \`sourceCatalogue\` (AIF | AIFdb | Argdown | WRM-2008 | admin-authored) + \`sourceId\`/\`sourceVersion\`/\`importedAt\`/\`importerVersion\`/\`createdBy\`/\`createdAt\`. Every field echoes a stored column verbatim.
- \`compare_scheme_provenance\` — 'same scheme under two presentations?' diagnostic: composes two provenance reads + the verifier. \`sameSource: false\` + \`verifierVerdict: 'equal'\` = duplicate-import candidates; same source + behavioural drift = a versioned divergence.

### Cluster 6 — Ludics generative substrate (17 tools)
Use when the user mentions **locus**, **design**, **behaviour**, **incarnation**, **cone**, **witness**, **articulation lattice**, **delocation**, **daimon**, or asks to **bind a participant** / **propose a synthesis** / **compress** or **join** articulations. Skip this cluster entirely for ordinary argument-graph questions — the deliberation graph (Clusters 2–4) is the public face; Ludics is the algebraic underlay.

**Read structure (Cluster F — orientation reads):**
- \`get_deliberation_schema\` — START HERE for any Ludics question. Returns locus count, design tree, witnessing-coverage summary. Costs O(1) round-trip; tells you whether the deliberation even has a Ludics layer worth exploring.
- \`list_behaviours\` — enumerate every Behaviour in a deliberation with summary stats (incarnationCount, coneCount, moveCount, walkedCount, witnessRatio), sorted most-articulated first. Use BEFORE \`get_behaviour_at_locus\` when you don't already know which loci exist — avoids guessing addresses.
- \`get_behaviour_at_locus\` — at a given locus, list the behaviour's designs + their cones + per-design witnessing state.
- \`get_exposure_map\` — per-locus map of walked / witnessable / latent moves; the dialectical surface a participant could engage.

**Lattice algebra (Cluster B — six Art(B) operations):**
- \`get_articulation_lattice\` — PRIMARY. Full Art(B) for a behaviour: incarnations, cones, inclusion edges, optional equivalence classes. Inc(B) is an antichain (Phase 2e): no global bottom, one minimum per cone.
- \`find_minimal_incarnations\` — antichain of per-cone bottoms. Use right after \`get_articulation_lattice\` to pick a target design for binding.
- \`find_equivalent_articulations\` — same ~_⊥⊥ biorthogonal class as a given design ("different incarnations, same testing behaviour").
- \`find_substitute_premises\` — incarnations that avoid a specified set of premises (useful for "can we still license C if we drop premise P?").
- \`compress_articulation\` — meet D₁ ∧ D₂. Partial: only defined within a single cone. Discriminated result: \`same-cone-meet\` | \`same-cone-incomparable\` | \`cross-cone-rejected\`.
- \`compute_articulation_join\` — join D₁ ∨_⊥⊥ D₂. Also partial. Discriminated result: \`same-cone-join\` | \`same-cone-delocation-required\` | \`cross-cone-rejected\`.

**Witness reads (Cluster E — read-side of the iota seam):**
- \`get_witnesses\` — active WitnessRecords for a LudicMove (T4: no participantId returned).
- \`get_unwitnessed_exposure\` — LudicMoves with non-empty exposure but no active witness.
- \`get_instantiation\` — whether a specific DialogueMove has been ι-bound to a LudicMove (verify before re-binding).
- \`list_bindable_moves\` — **HELPER for the bind workflow.** Returns LudicMoves eligible for \`bind_participant_to_design\`, each pre-paired with unused DialogueMoves carrying ready-to-submit \`canonicalText\`. Makes "bind me to design X" executable in one turn. Filter by \`designId\`, \`behaviourId\`, or \`locus\`.

**Write seams (Cluster D — the only paths that mutate Ludics state):**
- \`bind_participant_to_design\` — iota seam. The ONLY way to create a WitnessRecord. Enforces S1–S4 (locus exists, structure intact, canonicalText passes pipeline, scheme valid). Call \`list_bindable_moves\` first if you don't already have \`ludicMoveId\` + \`dialogueMoveId\` + \`canonicalText\`.
- \`propose_synthesis\` — Art(B) join write seam. Computes ∨_⊥⊥ of two designs in the same behaviour and commits the resulting Design + WitnessRecord. Discriminated result mirrors \`compute_articulation_join\`.

**Audit:**
- \`get_fossil_record\` — fossilized (retracted) WitnessRecords for a deliberation, with retract layer + reason.

### Cluster 7 — Dialectic moves: attacks + protocol dialogue (9 tools)
Use to **challenge or defend** arguments — to participate in the dialectic as a process, not just state positions. Two layers: the durable argument-graph attack layer (a typed edge that persists), and the dynamic dialogue-protocol layer (governed WHY/GROUNDS/CONCEDE exchange with commitment tracking). See Recipe I.

**Reads (call before you write):**
- \`get_legal_moves\` — the protocol-legal move set on a target RIGHT NOW for the side you intend to move on. Each move has \`kind\`, \`label\`, \`force\` (ATTACK/SURRENDER/NEUTRAL), and \`disabled\`+\`reason\` when blocked. **Pass the SAME \`speakAs\` you will move as** — author-only GROUNDS and non-author WHY depend on which side you are.
- \`get_legal_attacks\` — heuristic attack-shape cues for a piece of text (a conditional → challenge the antecedent, a conjunction → challenge a conjunct). A writing aid to seed a challenge, NOT a legality check.
- \`get_commitments\` — the per-participant commitment ledger. Read before a CONCEDE (what you would accept) or before asserting (what would contradict you). MCP sides show as \`mcp-bot:<speakAs>\`.

**Durable graph attack:**
- \`attack_argument\` — file a freestanding **REBUT** (conclusion false) / **UNDERCUT** (inference fails) / **UNDERMINE** (a premise/evidence false; needs ≥1 evidence) against an argument or claim, WITHOUT needing an answered CQ to hang it on. Point \`attacker\` at an existing node or pass \`groundsText\` and the server mints a scheme-free objection claim. **Honesty floor:** under a gating policy the attack lands \`ratificationStatus: PROPOSED\` and does NOT count as a defeat until a HUMAN ratifies it (the bot cannot). Report it as "filed, pending human sign-off", never "defeated". Rate limit 20/h.

**Protocol dialogue (legal-move gated):**
- \`post_dialogue_move\` — post WHY / GROUNDS / CONCEDE / RETRACT / CLOSE / ACCEPT_ARGUMENT. Call \`get_legal_moves\` first. On an illegal move it returns a STRUCTURED R-code (not an exception): \`R2_NO_OPEN_CQ\`, \`R3_SELF_REPLY\`, \`R5_AFTER_SURRENDER\`, \`R7_ACCEPT_ARGUMENT_REQUIRED\` (echoes a \`postAs\` hint — retry against the argument), \`MOVE_ILLEGAL\`, \`MOVE_RATE_LIMITED\`. A commitment-creating move that would contradict your ledger is surfaced as \`CONTRADICTION_DETECTED\` and REFUSED (no bypass). Rate limit 30/h.
- \`challenge_argument\` — ergonomic wrapper → a WHY. To DISAGREE with an argument/claim. Pass your \`expression\` (+ optional \`cqKey\` from a CQ or a get_legal_attacks cue).
- \`respond_to_challenge\` — ergonomic wrapper → a GROUNDS. To DEFEND: discharge an open WHY you are the author-side of. Pass the \`cqId\` of the open WHY (must match, else R2_NO_OPEN_CQ) and your \`groundsText\`.

**Recording that you found nothing to challenge:**
- \`decline_challenge\` — after you seriously examined an argument/claim and found NO admissible challenge, RECORD that. This is NOT a no-op. "No objections on file" is read as coverage, but that null only means something if agents who looked and found nothing SAY SO — an argument you never touched and one you scrutinised and could not fault look identical unless you log the second. If a panel of correlated agents shares a blind spot, an unrecorded silence lets a subtly-wrong argument pass as "unchallenged" when it was only "unchallenged BY US". Pass \`declineReason\` (premises hold, no counter-evidence found, …). Writes only a provenance record — it does not touch the graph, standing, or commitments.

**Force-refresh the derived ludics/AIF view (maintenance):**
- \`compile_deliberation\` — MCP dialogue moves + attacks are **record-only**: the dialectic substrate (DialogueMove / CQStatus / Commitment) is written immediately and the Cluster-7 reads see it fresh, but the compiled **Ludics** layer (designs / acts / traces) and the per-argument **AIF** graph are DERIVED and refreshed lazily — a debounced background worker recompiles ~seconds after your last move. Call this ONLY when you need a ludics-dependent surface (\`get_synthetic_readout\`, \`get_deliberation_fingerprint\`, \`get_contested_frontier\`, any Cluster-6 panel) to reflect your moves RIGHT NOW, after a run of moves. SLOW (seconds, occasionally minutes — wipe-and-recreate of every design); it coalesces with any in-flight background compile via a per-deliberation lock, so it never double-compiles. Rate limit **6/h** — do NOT poll it; one call after a burst is enough. Between a move and the background compile, ludics reads are stale but the dialectic protocol is always current.

\`coordinates\` (all writes, optional but STRONGLY encouraged): your independence coordinates — \`{ modelFamily, modelVersion, harnessId, sessionId, contextLineageId }\`. The epistemic value of a second checker is its DECORRELATION from the author, not headcount, so the graph records who (by error-source) authored/checked each act and computes correlation downstream. Report honestly. \`contextLineageId\` is highest-signal: give every agent forked from ONE context/conversation the SAME id, a genuinely separate agent a DIFFERENT one. Piling on same-lineage confirmations does not raise standing — to strengthen an argument, seek a DIFFERENT family or a human, not another copy of yourself.

\`speakAs\` (all writes, optional): a stable side label. Under the MCP bearer it namespaces the move as \`mcp-bot:<speakAs>\` — a DISTINCT dialogical side. Needed to legally challenge your OWN argument (steelmanning) or for two sessions to take opposite sides. Reuse the SAME label per side (commitments are per-side). It can NEVER impersonate a human. Omit → the bare service identity. Do NOT spin up personae to manufacture many-sided "agreement".

---

## Glossary (operational meanings)

- **argument** — A scheme-typed inference: premises + conclusion + scheme key. Identified by an \`id\` (cuid). Use this id with \`get_argument\`, \`cite_argument\`, and inside \`chains[].edges\`.

- **claim / MOID** — A conclusion's content-derived identifier. Multiple arguments can share a MOID (different reasonings, same conclusion). Use this with \`find_counterarguments\` and \`get_claim\`. Do not pass an argument id where a MOID is expected.

- **scheme** — The reasoning pattern. Examples: \`expert_opinion\`, \`analogy\`, \`cause_to_effect\`, \`inference_to_best_explanation\`. Each scheme has its own catalog of critical questions.

- **standing** — Lifecycle label, ordered: \`untested-default\` < \`untested-supported\` < \`tested-attacked\` < \`tested-undermined\` < \`tested-survived\`. Operational meaning when writing:
  - \`untested-*\`: do not assert as established. "X has been argued" is fine; "X is shown" is not.
  - \`tested-attacked\`: under active challenge, no resolution. Hedge.
  - \`tested-undermined\`: an attack has succeeded against this argument's premise/inference and has not been answered. Do NOT cite as evidence for the conclusion. Cite as "this line of reasoning is currently undermined."
  - \`tested-survived\`: an attack was raised and answered. May cite as standing evidence — but check \`standingDepth\` first.

- **standingDepth** — \`{ tier: "thin" | "moderate" | "dense", challengerCount, reviewerCount }\`. A \`tested-survived\` at \`thin\` depth (1 challenger) is much weaker than at \`dense\` (≥5 distinct challengers AND ≥5 distinct reviewers). Always qualify standing claims by depth.

- **fitness** — A weighted sum (NOT a probability, NOT 0-1). Negative means inbound attacks outweigh supports. Components are in \`fitnessBreakdown\`. Inbound attacks are weighted by attacker standing — refuted attackers contribute ≈0, unanswered contribute full weight.

- **chain** — Editor-curated traversal of the graph from premises to a conclusion. \`chainStanding\` is the WORST-link standing in the chain (not average). \`weakestLink\` names the bottleneck argument. Many deliberations have zero chains (chains are editor-authored, not auto-derived); fall back to \`frontier\` + \`topArguments\` when \`chains.chains\` is empty.

- **refusalSurface** — \`{ cannotConcludeBecause: [{ conclusionClaimId, blockedBy, blockerIds, blockerSummaries }] }\`. Conclusions the graph cannot license. Hard constraints — output must not assert any listed conclusion. Use \`blockerSummaries\` (parallel-indexed to \`blockerIds\`) to name the obstacle in prose without a per-blocker round-trip.

- **honestyLine** — A deterministic single-sentence caveat keyed on \`contentHash\`. Include verbatim in any synthesis output.

### Dialectic terms (Cluster 7)

- **speakAs / dialogical side** — An optional caller-chosen side label on any Cluster-7 write. Under the MCP bearer it namespaces the actor as \`mcp-bot:<speakAs>\`, giving the protocol a DISTINCT side that both traces to the service identity and satisfies R3_SELF_REPLY / author-only-GROUNDS / per-side commitments. Opt-in: omit it and you are the bare service identity. Reuse ONE label per side across every move on that side. It can never resolve to or impersonate a human participant.

- **commitment** — A proposition a participant is publicly committed to (via CONCEDE / ACCEPT_ARGUMENT), tracked per side in \`get_commitments\`. RETRACT withdraws one. A new assertion that contradicts your active commitments is refused with \`CONTRADICTION_DETECTED\`.

- **R-code** — A protocol-legality verdict returned (as \`code\`, not an exception) when a dialogue move is illegal: \`R2_NO_OPEN_CQ\` (GROUNDS with no matching open WHY), \`R3_SELF_REPLY\` (replying to your own move — use a different \`speakAs\`), \`R5_AFTER_SURRENDER\` (attacking a closed/conceded branch), \`R7_ACCEPT_ARGUMENT_REQUIRED\` (must ACCEPT_ARGUMENT, not bare CONCEDE — carries a \`postAs\` hint), \`MOVE_ILLEGAL\` (not in the current legal set), \`MOVE_RATE_LIMITED\`. Correct against it and retry.

- **ratificationStatus** — The lifecycle of a filed \`attack_argument\`: \`PROPOSED\` (filed under a gating policy, awaiting a HUMAN sign-off — NOT yet a defeat; the bot cannot ratify) or \`EFFECTIVE\` (counts immediately, under policy \`none\`). Report a PROPOSED attack as "filed, pending sign-off", never "defeated".

### Ludics terms (Cluster 6 only)

- **locus** — A stable address inside a design, written like \`⊢A.1.2\`. The unit of dialectical engagement; LudicMoves live at loci.

- **design (D)** — A set of loci with a polarity discipline; one specific articulation of a position. Identified by a cuid. Carries a \`derivedBy\` provenance label.

- **derivedBy** — How a design was produced. ∈ {\`null\`, \`"join"\`, \`"meet"\`, \`"compression"\`, \`"extend"\`}. \`null\` (or any unrecognized sentinel value from legacy seed data) marks a **base incarnation**; the four named values mark designs produced by Art(B) operations.

- **behaviour (B)** — Set of designs orthogonal to a common counter-set; the "type" a design inhabits. Behaviours own the lattice Art(B).

- **incarnation** — A design that is a minimum element of its cone in Inc(B). Post-Phase 2e, Inc(B) is an antichain: every base incarnation is cone-minimal.

- **cone** — Equivalence-by-base-ancestor partition of a behaviour's designs. Each cone has exactly one base incarnation at its bottom; all derived designs (join/meet/compression/extend) live in the cone of their most specific base ancestor. **Joins and meets are partial** — they only exist within a single cone (\`cross-cone-rejected\` is a returned value, not an error).

- **biorthogonal class (~_⊥⊥)** — Equivalence under "tested by the same counter-designs." Multiple designs may articulate the same behaviour differently but share a biorthoClass. Use \`find_equivalent_articulations\` to enumerate them.

- **articulation lattice Art(B)** — The poset \`(Inc(B), ≤_⊆, ∨_⊥⊥)\` of incarnations ordered by locus-set inclusion, with the partial join.

- **LudicMove** — A move at a locus. Carries \`moveType\` ∈ {\`"positive"\`, \`"negative"\`, \`"daimon"\`} and a \`stratumLabel\` ∈ {\`"walked"\`, \`"witnessable"\`, \`"latent"\`}. \`daimon\` moves close a branch and require a \`schemeKey\` when witnessed.

- **DialogueMove** — A canonical dialogue act in the deliberation graph (kind ∈ ASSERT|WHY|GROUNDS|RETRACT|…). Becomes the \`dialogueMoveId\` parameter when binding; \`@unique\` on WitnessRecord, so each dialogue act may witness at most one LudicMove.

- **witness / WitnessRecord** — A binding of (LudicMove, DialogueMove, participantId, canonicalText). The iota seam: the ONLY way to instantiate a ludic move is through \`bind_participant_to_design\`. T4 invariant: \`participantId\` is stored but never returned in reads.

- **canonicalText** — Must equal \`JSON.stringify({ text: <NFC-normalized, whitespace-collapsed string> })\` — the output of the canonicalization pipeline. Pass straight from \`list_bindable_moves[].candidateDialogueMoves[].canonicalText\`; do not hand-construct.

- **delocation** — When a literal chronicle-set union would collide at a locus, one side must be relocated before the join can be taken. Surfaced as \`same-cone-delocation-required\` from \`compute_articulation_join\`.

- **fossilization** — Soft retraction of a WitnessRecord. \`fossilizedAt\` non-null + \`retractLayer\` ∈ {\`argument_superseded\`, \`locus_deleted\`, \`design_excised\`, \`manual_retract\`}. Fossilized witnesses are excluded from active reads but preserved for audit (\`get_fossil_record\`).

- **frontier** — Open dialectical edges: \`unansweredUndercuts\`, \`unansweredUndermines\`, \`unansweredCqs\`. Each carries a \`schemeTypical\` flag — true means the catalog expected this challenge and nobody raised it.

- **missingMoves** — Catalog-vs-actual diff. \`missingCqs\`, \`missingUndercutTypes\`, plus deliberation-level rollups (\`metaArgumentsAbsent\`, \`crossSchemeMediatorsAbsent\`).

- **writingConstraints** — Pre-computed compliance contract on every readout (added 2026-05). Read this BEFORE composing output:
  - \`mustInclude.honestyLine\` — drop verbatim into output.
  - \`mustInclude.refusalNotice\` — pre-rendered caveat sentence; non-null when refusalSurface is non-empty. Drop verbatim.
  - \`mustNotAssert[]\` — claims you may not assert as established; each entry has \`claimMoid\`, \`claimTextPreview\`, pre-rendered \`reason\`.
  - \`shouldHedge[]\` — arguments to qualify; each entry has a pre-rendered \`suggestedFraming\` you can splice into prose.
  - \`framing.stage\` ∈ {articulation | deliberation | matured} with \`advisoryNote\` you should adopt.

## Workflow recipes

### Recipe A — Synthesize the state of a debate

1. \`get_synthetic_readout(deliberationId)\`.
2. Read \`writingConstraints\`:
   - Insert \`mustInclude.honestyLine\` verbatim into your output.
   - If \`mustInclude.refusalNotice\` is non-null, include it.
   - Do not assert any claim listed in \`mustNotAssert\`.
   - For any argument referenced in \`shouldHedge\`, splice its \`suggestedFraming\` into the prose around it.
   - Adopt \`framing.advisoryNote\` for the overall framing.
3. For structure, walk \`chains[]\` in order — each has \`weakestLink\` and \`chainStanding\`. Frame each chain by what survives, not just what's claimed.
4. Use \`topArguments\` for load-bearing premises, \`mostContested\` for active disputes. Do NOT call \`get_argument\` per node — they're hydrated.
5. Stop. Do not invent a closer; localize uncertainty to specific claims.

### Recipe B — Explore "what's pushing back on claim X?"

1. From the readout (or \`get_claim\`), get the claim's MOID.
2. \`find_counterarguments(claim_moid, deliberation_id)\` — pass the deliberation id to scope to this debate. Omit it for cross-deliberation discovery (different question).
3. For each returned counterargument, check its \`standing\` and \`standingDepth\` before treating it as a real challenge. An \`untested-default\` counterargument is a registered objection, not a proven one.

### Recipe C — Walk a chain step by step

1. From the readout, pick a \`chains[i]\` by id.
2. The chain's \`edges[]\` is in topological order. Each edge has \`{ from, to, edgeType }\` where edgeType ∈ support/rebut/undercut/undermine.
3. The chain's nodes are hydrated with \`argumentText\`, \`standing\`, \`standingDepth\`. Walk in order; narrate each edge as "X supports Y" / "X undercuts Y's inference" / etc.
4. The \`weakestLink\` is the node where the chain's standing collapses — start diagnosis there.

### Recipe D — Help answer an open critical question

1. \`get_synthetic_readout\` → \`frontier.unansweredCqs[]\` lists open CQs by argument id and CQ key.
2. \`get_argument(argumentId)\` to fetch the full attestation (premises, conclusion, scheme, evidence).
3. The CQ key maps to the scheme catalog — its meaning is determined by the scheme, not by the argument. Treat the CQ as: "what would the literature require to answer this for THIS scheme on THIS argument?"
4. If composing a draft answer, structure it as a new argument that either supports the original (CQ-as-rebutted) or as an undercut of the original (CQ-as-conceded). Do not write CQ answers as free-form commentary.

### Recipe E — Record an argument (the WRITE path)

Use this whenever the user states a position, says "log this claim / save this argument / I want to register that X", drafts a thesis paragraph with reasons + sources, or asks you to capture your own synthesis as a durable artifact. Do not reply in prose when the user wants a record; create one.

**Pick the right write tool first:**
- If the user gave reasons, premises, or named a reasoning pattern (expert opinion, analogy, cause-to-effect, practical reasoning, sign, abductive, IBE) → \`propose_structured_argument\`.
- If the user has a one-line bare claim with no premises worth naming → \`propose_argument\`.
- If unsure, prefer the structured tool — a single inferred premise is fine, and the resulting card surfaces dialectical obligations the bare path hides.

#### E.1 — Bare assertion (\`propose_argument\`)

1. \`propose_argument({ claim, reasoning?, evidence?[], deliberationId? })\`:
   - \`claim\` (required, ≤2000 chars) — the conclusion sentence.
   - \`reasoning\` (optional, ≤5000 chars) — the inferential bridge between evidence and claim. Provide it; arguments without reasoning have minimum fitness.
   - \`evidence\` (optional, up to 10) — each \`{ url, title?, quote? }\`. Quotes get provenance-enriched in the background. Resolve DOIs / arXiv IDs via \`resolve_citation\` first.
   - \`deliberationId\` (optional) — omit to land in the user's "My Arguments" room.
2. The response gives \`{ argumentId, claimId, permalink, immutableUrl }\`. The immutable URL is content-addressed.
3. **Verify the round-trip** by calling \`get_argument(argumentId)\` (after \`retryAfterMs\` if \`provenancePending\` is true). Report back the immutable URL, the resulting \`standing\` (will be \`untested-default\` until challenged), and the \`fitness\`.

#### E.2 — Structured argument (\`propose_structured_argument\`)

1. (Optional) \`list_schemes\` to browse the catalog if you don't know which scheme matches the user's reasoning. Filter by \`clusterTag\` (\`expert\` | \`causal\` | \`practical\` | \`analogical\` | …) to narrow. **Pass \`excludeUnhealthy: true\`** so the picker only returns production argument patterns — the write surface REFUSES dialogue-meta / test-placeholder keys with \`code: "SCHEME_NOT_ARGUMENT_PATTERN"\` (nothing written).
2. (Optional) \`resolve_citation\` for any DOI / arXiv id / publisher URL the user gave — the resolved canonical URL goes into \`evidence[].url\`.
3. \`propose_structured_argument({ conclusion, premises[], reasoning?, schemeKey?, ruleType?, epistemicMode?, evidence?[], deliberationId? })\`:
   - \`conclusion\` (required) — the sentence the argument supports.
   - \`premises[]\` (required, 1–10) — each \`{ text, isAxiom?, premiseType?, evidence?[] }\`. Each premise is committed as its own Claim row, so attackers can later undermine specific premises rather than the whole argument. \`premiseType\` ∈ \`ordinary\` | \`assumption\` | \`exception\` (Carneades; default \`ordinary\`) controls the defeasibility role — an \`exception\` premise is one whose *truth* defeats the inference. **Per-premise evidence (recommended):** when each premise has its own distinct source (e.g. a multi-source policy argument), attach it via \`premises[i].evidence[]\` (≤ 5 per premise). The evidence lands on that premise's minted Claim row, so per-source provenance maps onto per-premise standing rather than being collapsed onto the conclusion.
   - \`reasoning\` (optional) — narrative gloss tying premises to conclusion; stored on \`Argument.text\`.
   - \`schemeKey\` (optional) — from \`list_schemes(excludeUnhealthy: true)\`. Omit and the server infers one (response includes a \`scheme_inferred\` warning). A folksonomy-duplicate key is auto-redirected to its canonical sibling with a \`SCHEME_CANONICALIZED\` warning whose \`canonical\` field names the key actually used (never a silent merge).
   - \`epistemicMode\` (optional) — defaults to the scheme's catalogue value. Override (\`FACTUAL\` | \`HYPOTHETICAL\` | \`COUNTERFACTUAL\`) only when the reasoning is genuinely hypothetical/counterfactual; an override shifts the behaviour-fingerprint domain and returns an \`EPISTEMIC_MODE_CHANGED_FINGERPRINT\` warning (\`canonical\` = the mode applied).
   - \`evidence[]\` (optional, up to 10) — top-level evidence attaches to the **conclusion** claim. Use this only for sources that back the overall argument rather than one specific premise; otherwise prefer per-premise \`premises[i].evidence[]\`.
   - \`deliberationId\` (optional) — omit for "My Arguments".
4. The response gives \`{ argument, claim, premises[], schemeInstance, verifierVerdict, warnings[], permalink, embedCodes, provenancePending, retryAfterMs }\`. **Read \`warnings[]\`** — each entry is \`{ code, detail, canonical? }\`. Canonical (§4.1) codes carry the corrected value in \`canonical\`: \`SCHEME_CANONICALIZED\` (announce the redirect, attach to \`canonical\`), \`EPISTEMIC_MODE_CHANGED_FINGERPRINT\`, \`VERIFIER_INCONCLUSIVE\` (the same-fingerprint behaviour check could not decide — the argument still shipped; treat as 'unknown', not a failure). Operational diagnostics: \`scheme_inferred\` (server picked the scheme — announce it), \`scheme_behaviour_verdict\` (a clean equal/subset relationship against a same-fingerprint sibling, persisted for the catalogue audit), \`missing_slot\` (scheme-required slots not yet bindable — mention as "v1.2 will let you bind the \`expert\` slot explicitly"), \`premise_deduped\` (duplicate-text premises collapsed into one Claim), \`premise_evidence_merged\` (a deduped premise's evidence was merged into the surviving claim, so no source is lost). A 400 with a top-level \`code\` (\`SCHEME_UNKNOWN\` or \`SCHEME_NOT_ARGUMENT_PATTERN\`) + \`canonical\` means the write was REFUSED — re-pick via \`list_schemes(excludeUnhealthy: true)\`.
5. **Verify the round-trip** with \`get_argument(argumentId)\` (after \`retryAfterMs\` if \`provenancePending: true\`). The result should show all premises in the "Premises" section (no "bare assertion" warning), the assigned scheme, and any critical questions.
6. Do not invent ids, permalinks, or hashes — only echo values the write tool returned.

#### E.3 — Argument chain (\`propose_argument_chain\`)

Use when the user lays out **multi-step reasoning** — "A, therefore B; and B, therefore C", a derivation, or a several-stage justification — rather than one argument. Prefer this over emitting several disconnected \`propose_structured_argument\` calls: it wires the links into one navigable chain and reports the worst-link standing.

**Two non-negotiable best practices for every chain:**
- **Build modular, then compose** — do NOT one-shot a chain you are minting from scratch. Mint each link as its own \`propose_structured_argument\` call, then bind the finished arguments with \`mode: 'compose'\`. (One-shot \`mint-and-link\` is a convenience for SMALL, evidence-light chains of 2–3 links only.)
- **Always pass a stable \`requestId\`** (a UUID generated ONCE for the chain) on every \`propose_argument_chain\` call — it makes the write retry-safe.

**Recommended flow (modular — use this by default):**
1. (Optional) \`list_schemes(excludeUnhealthy: true)\` to pick a healthy \`schemeKey\` per link.
2. For each link in spine order, call \`propose_structured_argument({ conclusion, premises[], schemeKey?, evidence?[], deliberationId })\`. Each is a small, fast write; its response carries the just-minted argument under \`argument.id\` and the conclusion claim under \`claim.id\` (a \`{ id, text, moid }\` object).
3. **Thread as you go (fork-proof):** when minting link *k+1*, include a premise \`{ reuseClaimId: "<link k's claim.id>" }\` — the conclusion-claim id from link *k*'s response. That premise then SHARES link *k*'s exact Claim row, with no reliance on byte-exact text repetition (an unknown or cross-deliberation id is rejected with \`PREMISE_CLAIM_NOT_FOUND\`, so typos fail fast instead of silently forking). A link that branches gets that reused premise plus its own fresh \`{ text }\` premises. (Exact-text repetition still works as a fallback — content-hashing dedups identical text onto the same claim — but \`reuseClaimId\` is the robust choice.)
4. Bind them: \`propose_argument_chain({ mode: 'compose', argumentIds: [<each link's argument.id, spine order>], name, deliberationId, requestId })\`. \`compose\` does NO minting and does NOT re-thread — it wires the existing arguments into a serial spine **in the order you pass them** and computes the worst-link standing, so the genuine claim-sharing must already be in place from step 3.

Why modular is the default: every write stays well under the request timeout; a single failed link can be retried in isolation instead of rolling back the whole chain; and \`reuseClaimId\` threading is fork-proof.

**One-shot mint-and-link (small chains only):** \`propose_argument_chain({ name, links[], requestId, deliberationId })\` mints 2–12 links and threads them in a single transaction. Each \`links[i]\` is a \`propose_structured_argument\` payload. Thread by either (a) \`{ reuseClaimId }\` referencing a *prior* link's conclusion, or (b) repeating the prior link's **exact** conclusion text as a \`{ text }\` premise (the server content-hash-threads it; a \`chain_link_autothreaded\` warning confirms). The health gate runs **per link** — one unhealthy/non-argument scheme rolls back the WHOLE chain (atomic). Use this ONLY for short, evidence-light chains; reach for the modular flow above the moment a chain is large, evidence-heavy, or a one-shot times out.

**On a timeout:** RETRY the SAME call with the SAME \`requestId\` — the server replays the chain that already landed (\`idempotentReplay: true\`) instead of duplicating it. That replay is NOT a hopeful guess: it is the persisted chain read back from the database, so the \`idempotentReplay: true\` response IS your authoritative confirmation of exactly what landed — treat it as the result of the write, not a promise. Do NOT change the requestId, and do NOT \`get_chains\`-then-recreate to "check"; just retry with the same key. (The one-shot chain write now allows up to 120s before the client gives up, so a focused chain usually returns on the first call.)

The response gives \`{ chain{ id, rootNodeId, permalink }, links[], edges[], threading[], chainStanding, weakestLink, warnings[], chainRedundancyFlag, provenancePending, retryAfterMs }\` (or, on an idempotent retry, the same \`chain\`/\`links\`/\`edges\` with \`idempotentReplay: true\`). **Read it:**
   - \`threading[]\` confirms which links share which claim (\`mode: "moid" | "explicit"\`). If a link you meant to thread is absent, the texts didn't hash-match — fix the wording or use \`reuseClaimId\`.
   - \`chainStanding\` is the **worst link's** standing — a chain is only as citable as its weakest link; \`weakestLink.argumentId\` names where it collapses.
   - Per-link \`schemeHealth\` / \`verifierVerdict\`; \`chain_link_scheme_repeat\` warns when two links share a behaviourally-equal scheme (advisory); \`chainRedundancyFlag: true\` flags a redundant link for the catalogue audit.
   - Error codes (nothing written): \`CHAIN_LINK_BROKEN\` (a declared reuse text forked into a different claim), \`CHAIN_LINK_INVALID_THREAD\` (a \`reuseClaimId\` was a forward/cyclic/non-prior reference), \`CHAIN_TOO_SHORT\`/\`CHAIN_TOO_LONG\`, \`CHAIN_LINK_NOT_FOUND\` (compose id missing / wrong deliberation), plus the per-link \`SCHEME_NOT_ARGUMENT_PATTERN\`.

**Advanced structure (optional — all default off, so a plain serial chain ignores them):** these ALL require \`mode: 'mint-and-link'\` (they ride on \`links[]\`; \`compose\` carries ids only and cannot express branching, attacks, scopes, or anchored evidence). Keep such a chain focused (≤12 links) so the one-shot transaction stays under the timeout.

- **Branching** — supply \`edges[]\` (typed relations between links by index) to author a non-serial shape: \`SUPPORTS\`/\`ENABLES\`/\`PRESUPPOSES\` thread a claim forward; the server derives the \`chainType\` (\`SERIAL\`/\`CONVERGENT\`/\`DIVERGENT\`/\`TREE\`/\`GRAPH\`) from the support sub-graph, validates it is acyclic (\`CHAIN_CYCLE_DETECTED\`), and rejects a mismatch with an \`expectChainType\` you pin (\`CHAIN_TYPE_MISMATCH\`, echoing the derived type). The response gains \`topology\` + \`edges[]\` (with real edgeType/strength).
- **Attacks** — give a link \`attacksNode: <i>\` to REBUT a prior link's conclusion or UNDERMINE its premise (\`attackType\`), or \`attacksEdge: { from, to }\` to **UNDERCUT the inference itself** (the reasoning link, not the claims). Attacks never thread claims; only support edges do. Attacking an attack edge → \`CHAIN_ATTACK_ON_ATTACK\` (depth-1 cap). The response gains an \`attacks[]\` register.
- **Suppositions** — declare \`scopes[]\` (e.g. \`{ scopeType: "HYPOTHETICAL", assumption: "If the carbon tax passes" }\`) and place links inside one with \`scope: <index>\`. Those nodes are recorded as hypothetical/counterfactual and **cannot leak** as asserted premises outside the scope (\`SCOPE_LEAK\`); nest scopes with \`parentScope\` (max depth 4). Each link gains \`epistemicStatus\` + \`scopeId\` in the response, and \`scopes[]\` echoes the declared suppositions. Use per-link \`epistemicStatus\` / \`dialecticalRole\` for finer epistemic / thesis-antithesis labelling.
- **Executable evidence** — an \`evidence[]\` item may carry a \`locator\` ("p. 13", "08:14"), an \`anchorType\` + \`anchorData\` (\`page\` / \`text_range {start,end}\` / \`timestamp {start,end?}\` / \`coordinates {x,y,width,height}\` / \`annotation\` via \`anchorId\`), and a semantic \`intent\` (supports / refutes / context / …). For \`text_range\` you rarely have character offsets when citing a PDF/report — in that case just set the item's \`quote\` to the verbatim passage (omit \`anchorData\`) and the anchor is accepted as a passage. Such items resolve the url to a \`Source\` and write a resolvable \`Citation\` against the link's claim (surfaced as \`citations[]\` per link); a malformed anchor → \`EVIDENCE_ANCHOR_MALFORMED\`, an unresolvable url → \`EVIDENCE_SOURCE_UNRESOLVED\`, and a contrary \`intent\` (e.g. \`refutes\` on a support link) → an \`evidence_intent_contrary\` warning (advisory, still written). Plain \`{ url, quote }\` evidence is unchanged (ClaimEvidence only, no Citation).

**Then verify** with \`get_chains(deliberationId)\` before citing the chain's terminal conclusion.

Sibling write tool — \`propose_warrant\` — attaches an inference-license warrant to an existing argument inside an ECC-typed deliberation. Use it when the user says "add a warrant" / "license this inference" against a specific argument id, not for freestanding claims.

#### E.4 — Answer a critical question (\`answer_critical_question\`)

Use when you can DISCHARGE one of an argument's open dialectical obligations — the literature-required critical questions a scheme demands. Every scheme attaches named CQs (expert-opinion → \`expertise\`, \`bias\`, \`backup_evidence\`; cause-to-effect → \`other_causes\`; etc.); answering one raises the argument's dialectical fitness and closes the obligation.

1. \`get_argument(idOrPermalink)\` → read the \`criticalQuestions\` aggregate (a single object: \`{ schemeKey, total, answered[], partiallyAnswered[], unanswered[] }\`, or \`null\` when the scheme defines no CQs). Pick an entry from \`unanswered[]\` (or \`partiallyAnswered[]\`) and take its \`cqKey\`, its \`schemeKey\`, and (for reference) \`cqStatusId\`.
2. \`answer_critical_question({ argumentId, cqKey, schemeKey?, groundsText, evidenceClaimIds?, sourceUrls?, sessionId, promoteToCanonical?, requestId })\`:
   - \`argumentId\` / \`cqKey\` (required) — the target from step 1.
   - \`schemeKey\` — pass it ONLY when the server returns \`CQ_AMBIGUOUS_SCHEME\` (the same \`cqKey\` is inherited by more than one of the argument's schemes); otherwise omit and it is inferred.
   - \`groundsText\` (required, 10–5000) — the actual answer: state what satisfies the CQ and why. Make it self-contained.
   - \`evidenceClaimIds[]\` / \`sourceUrls[]\` — optional backing (existing Claim ids must resolve, else \`CQ_EVIDENCE_NOT_FOUND\`).
   - \`requestId\` — a stable UUID; on a timeout RETRY with the SAME value (server replays \`idempotentReplay: true\`).
3. **\`sessionId\` discipline (the self-canonicalisation rule):** pass the SAME \`sessionId\` you used when you CREATED the argument (the per-session UUIDv4 you thread through every \`propose_*\` write). When it matches the argument's AI provenance your answer is promoted directly to **CANONICAL** (response \`canonical: true\`, \`responseStatus: CANONICAL\`, the CQ's \`CQStatus.statusEnum → SATISFIED\`). A different/absent \`sessionId\`, a human-authored target, or \`promoteToCanonical: false\` records a **PENDING** proposal (\`canonical: false\`, non-fatal \`CQ_SELF_CANONICAL_DENIED\` warning) that a human approves on the web CQ panel. \`promoteToCanonical\` defaults true and is a SOFT request — denial is never an error.
4. The response gives \`{ cqStatusId, responseId, responseStatus, canonical, cqStatusEnum, permalink, warnings[] }\`. Error codes (nothing written): \`CQ_ARGUMENT_NOT_FOUND\`, \`CQ_NOT_FOUND\` (no such cqKey on the argument's schemes), \`CQ_AMBIGUOUS_SCHEME\` (resend with \`schemeKey\`), \`CQ_EVIDENCE_NOT_FOUND\`, \`CQ_DUPLICATE_PENDING\` (409 — you already have a pending answer on this CQ).
5. **Verify** with \`get_argument(argumentId)\` — the CQ should move out of \`unanswered[]\` (canonical → its \`answered\` count reflects your answer).

#### E.5 — Challenge an answered critical question (\`challenge_critical_question\`)

The **dual** of E.4. Use when an argument's CQ already has a canonical answer (it sits under \`criticalQuestions.answered[]\`) and you believe that answer is wrong, unsupported, or fallacious. Filing a challenge mints a scheme-free objection claim, draws a typed attack edge at the canonical answer, and flips the CQ **SATISFIED → DISPUTED**. This is an *admissibility* move — it re-opens the question; it does NOT by itself decide who wins (defeat is evaluated separately by the grounded-semantics pass that feeds standing). There is **no self-canonical floor** — any caller, the argument's original author included, files on equal footing, so no \`sessionId\` is involved.

1. \`get_argument(idOrPermalink)\` → read \`criticalQuestions.answered[]\`. Pick the entry you dispute and take its \`cqKey\` and \`schemeKey\`.
2. \`challenge_critical_question({ argumentId, cqKey, schemeKey?, attackType, groundsText, evidenceClaimIds?, sourceUrls?, requestId })\`:
   - \`argumentId\` / \`cqKey\` (required) — the answered CQ from step 1.
   - \`schemeKey\` — pass it ONLY when the server returns \`CQ_AMBIGUOUS_SCHEME\`; otherwise omit.
   - \`attackType\` (required, **never inferred**) — choose how you attack the answer: **REBUT** (its conclusion is false — you assert the contrary), **UNDERMINE** (a premise / the cited evidence is false or unreliable), **UNDERCUT** (the inference fails even granting the premises). An **UNDERMINE always requires evidence** (≥1 \`evidenceClaimIds\`/\`sourceUrls\`), and some CQs additionally place the evidential burden on the challenger — the server enforces both with \`CQ_CHALLENGE_NEEDS_EVIDENCE\`.
   - \`groundsText\` (required, 10–5000) — the objection itself: what is wrong with the canonical answer and why. Self-contained.
   - \`evidenceClaimIds[]\` / \`sourceUrls[]\` — backing for the challenge (existing Claim ids must resolve, else \`CQ_EVIDENCE_NOT_FOUND\`).
   - \`requestId\` — a stable UUID; on a timeout RETRY with the SAME value (server replays \`idempotentReplay: true\`).
3. The response gives \`{ ok, cqStatusId, challengeClaimId, answerClaimId, claimEdgeId, cqAttackId, cqStatusEnum, attackType, permalink, idempotentReplay? }\` — \`cqStatusEnum\` is now \`DISPUTED\`. Error codes (nothing written): \`CQ_ARGUMENT_NOT_FOUND\`, \`CQ_NOT_FOUND\`, \`CQ_AMBIGUOUS_SCHEME\` (resend with \`schemeKey\`), \`CQ_NOT_ANSWERED\` (409 — the CQ has no canonical answer to challenge; use \`answer_critical_question\` instead), \`CQ_CHALLENGE_NEEDS_EVIDENCE\` (422 — UNDERMINE / challenger-burden CQ with no evidence), \`CQ_EVIDENCE_NOT_FOUND\`, \`CQ_DUPLICATE_CHALLENGE\` (409 — you already have a live challenge on this answer).
4. **Verify** with \`get_argument(argumentId)\` — the CQ should now read DISPUTED (it leaves \`answered[]\` and carries the challenge).

### Recipe F — Explore a deliberation's Ludics layer

Use when the user mentions locus, design, behaviour, incarnation, cone, articulation lattice, or asks how a position is "structurally articulated".

1. \`get_deliberation_schema(deliberationId)\` — confirms a Ludics layer exists and surfaces the design tree + witnessing coverage. If \`designCount === 0\` the deliberation has not been Ludics-lifted; stop and tell the user.
2. Pick a behaviour from the schema's design tree (each Design carries a \`behaviourId\`). For a specific position the user named, use \`get_behaviour_at_locus(deliberationId, locus)\` instead to find the behaviour from the locus.
3. \`get_articulation_lattice(behaviourId)\` — returns \`{ incarnations[], cones[], edges[] }\`. Each incarnation has a \`coneId\`; \`cones[]\` lists per-cone minima (\`bottomIncarnationDesignId\`). Inc(B) is an antichain, so "the minimum" is per-cone, never global — narrate accordingly.
4. \`find_minimal_incarnations(behaviourId)\` if all the user wants is the antichain of bottoms (cheaper than the full lattice).
5. For "what else articulates the same testing-behaviour as design D?" use \`find_equivalent_articulations(designId)\`. For "can the position survive without premise P?" use \`find_substitute_premises\`.
6. Compose results by cone — never mix designs from different cones into a single "reduction" narrative. Cross-cone results from \`compress_articulation\` or \`compute_articulation_join\` are partial (\`cross-cone-rejected\` is a value, not an error); surface that explicitly to the user.

### Recipe G — Bind a participant to a chosen incarnation

Use when the user says "bind me to design X", "commit to the minimal incarnation", "witness the join", "record my position at locus Y". This is a WRITE workflow — it produces a WitnessRecord.

1. **Pick the target design.** Either:
   - \`find_minimal_incarnations(behaviourId)\` → pick the smallest / largest / user-chosen incarnation; OR
   - \`get_articulation_lattice(behaviourId)\` → pick by coneId / inclusion structure.
2. \`list_bindable_moves(deliberationId, { designId })\` → returns LudicMoves on that design with \`{ ludicMoveId, locus, moveType, witnessed, candidateDialogueMoves[] }\`. Each candidate carries a ready-to-submit \`{ dialogueMoveId, canonicalText, locusAlignedExactly }\` triple. Default scope excludes already-witnessed moves; pass \`includeWitnessed: true\` to inspect them.
3. Choose a row where \`witnessed === false\` and at least one \`candidateDialogueMoves[i].locusAlignedExactly === true\`. If none exists, tell the user no aligned dialogue act is available and stop — do not invent one.
4. \`bind_participant_to_design({ deliberationId, ludicMoveId, dialogueMoveId, canonicalText, participantId, schemeKey? })\` using the chosen triple. \`canonicalText\` MUST be the value from \`candidateDialogueMoves[i].canonicalText\` — do not re-canonicalize on the client. \`schemeKey\` is required when \`moveType === "daimon"\`; optional otherwise (use \`list_schemes\` if needed).
5. On success, the result carries \`invariantChecks: { S1_existingLocus, S2_existingStructure, S3_canonPipelineGated, S4_schemeTyped }\` all true and a \`witnessId\`. Report the witnessId to the user; do NOT report \`participantId\` back (T4 non-attribution).
6. (Optional) Verify with \`get_instantiation(deliberationId, dialogueMoveId)\` — should return \`instantiated: true\` with the LudicMove locus.

### Recipe H — Decide whether two schemes are the same / find redundancy / attribute a scheme

Use when the user asks "are these two schemes the same?", "is this a duplicate?", "where did this scheme come from?", or before authoring/importing a scheme you want to avoid duplicating. The catalog is a folksonomy converging on an ontology — there is no canonical form, so a fingerprint match is a CANDIDATE signal, never a proof.

1. **"Are scheme A and scheme B the same?"** → \`verify_scheme_equality(keyA, keyB)\`. Read \`verdict\`, NOT \`fingerprintsMatched\`: \`equal\` (interchangeable) / \`subset\` (one specialises the other) / \`incomparable\` (genuinely distinct) / \`inconclusive\` (verifier hit its bound — say "undecided", do not claim they differ). Optionally raise \`searchBoundMs\` and re-run if \`inconclusive\`.
2. **"Is this scheme a duplicate of anything in the catalog?"** → \`find_behaviourally_similar_schemes(schemeKey)\`. Bucket-then-verify; \`hits\` ordered \`equal\` → \`subset\` → \`incomparable\` → \`inconclusive\`. Empty \`hits\` = "no behavioural near-duplicate found" (a real negative, not "unchecked"). Use \`compute_scheme_fingerprint\` only when you want the raw bucket key.
3. **"Where did this scheme come from?"** → \`get_scheme_provenance(schemeKey)\` for the source-of-record (\`sourceCatalogue\` + import metadata). \`null\` import fields = admin-authored; \`createdBy: null\` = a pre-Q024 migrated row (its \`createdAt\` is the migration moment, not the authoring time).
4. **"Are these two keys the same scheme under different presentations?"** → \`compare_scheme_provenance(keyA, keyB)\`. \`sameSource: false\` + \`verifierVerdict: 'equal'\` = duplicate-import candidates worth flagging; \`sameSource: true\` + a non-equal verdict = a versioned divergence. Always quote \`verifierVerdict\` (authoritative) over \`behaviourFingerprintEqual\` (pre-filter).
5. None of these tools mutate state — they are safe to run during synthesis or before a write. Do not present \`inconclusive\` / \`behaviourFingerprintEqual\` as a definitive equality claim.

### Recipe I — Challenge and defend in a dialogue

Use to contest an argument you disagree with, or defend one under challenge — participating in the dialectic, not just reading it. Two paths: a DURABLE graph attack (persists as a typed edge) and a DYNAMIC protocol challenge (a governed WHY/GROUNDS exchange with commitment tracking). Pick a stable \`speakAs\` for each side you play and reuse it on every move of that side.

1. **See what's legal.** \`get_legal_moves({ deliberationId, targetType, targetId, speakAs })\` — pass the SAME \`speakAs\` you intend to move as (author-only GROUNDS / non-author WHY depend on it). Optionally \`get_legal_attacks({ text })\` for attack-shape cues to seed an objection.
2. **To disagree — two options:**
   - *Durable graph objection* → \`attack_argument({ deliberationId, target, attackType, groundsText | attacker, targetPremiseId?, evidenceClaimIds?, speakAs?, requestId })\`. Choose REBUT / UNDERCUT / UNDERMINE (UNDERMINE needs ≥1 \`evidenceClaimIds\`/\`sourceUrls\`). Read back \`ratificationStatus\`: if \`PROPOSED\`, report "filed, pending human sign-off" — it is NOT a defeat until a human ratifies (the bot cannot). Returns \`objectionClaimId\` when it minted from \`groundsText\`.
   - *Protocol challenge* → \`challenge_argument({ deliberationId, targetType, targetId, expression, cqKey?, speakAs, requestId })\` opens a WHY.
3. **To defend** — as the author-side of the target: \`respond_to_challenge({ deliberationId, targetType, targetId, cqId, groundsText, evidenceRefs?, speakAs, requestId })\` discharges an open WHY (→ GROUNDS). Use the SAME \`speakAs\` as the side that OWNS the argument, else the move is disabled (see get_legal_moves) or returns \`R2_NO_OPEN_CQ\` if no WHY is open on that key.
4. **Commitments / concession.** Before a CONCEDE, \`get_commitments({ deliberationId })\` to see what you'd accept and what would contradict you. Then \`post_dialogue_move({ kind, ... })\` with CONCEDE / ACCEPT_ARGUMENT / RETRACT / CLOSE. Once a claim has been answered by GROUNDS the protocol requires **ACCEPT_ARGUMENT** (not bare CONCEDE); \`R7_ACCEPT_ARGUMENT_REQUIRED\` echoes a \`postAs\` hint pointing at the argument — retry with it.
5. **Illegal moves are data, not crashes.** \`post_dialogue_move\` (and the wrappers) return a structured \`{ ok:false, code, error }\` — \`R2_NO_OPEN_CQ\` / \`R3_SELF_REPLY\` / \`R5_AFTER_SURRENDER\` / \`R7_ACCEPT_ARGUMENT_REQUIRED\` / \`MOVE_ILLEGAL\` / \`MOVE_RATE_LIMITED\`. Correct against the code and retry. \`CONTRADICTION_DETECTED\` means the move would break your own commitments and was refused (no bypass).
6. **Steelmanning your OWN argument:** author it as one side (e.g. \`speakAs: "proponent"\`), then challenge it as another (\`speakAs: "opponent"\`). The two sides are distinct actors, so \`R3_SELF_REPLY\` does not fire. NEVER spin up many personae to manufacture agreement — it is a misuse.
7. Pass a stable \`requestId\` on every write for retry-safety (a replay returns the same result with \`idempotentReplay: true\`).

## Things to avoid

- Synthesizing from raw \`search_arguments\` hits when \`get_synthetic_readout\` is available. The readout is the editorial primitive; search is for lookup.
- Treating \`tested-undermined\` as "weak but cite-able." It means an attack has succeeded and not been answered. Do not use it as supporting evidence.
- Conflating argument-as-stated with argument-as-tested. A 143-argument deliberation with \`depthDistribution.thin\` dominant is articulation-stage, not deliberation-stage; standing labels mean less. \`writingConstraints.framing.stage\` will say "articulation" in this case.
- Asserting a claim listed in \`refusalSurface.cannotConcludeBecause\` (or equivalently, \`writingConstraints.mustNotAssert\`). Even with strong-looking supports, the unanswered attacks are dispositive.
- Inventing argument or chain IDs. All references must come from tool output.
- Calling \`get_argument\` for IDs already hydrated in \`topArguments\` / \`mostContested\` / chain nodes — those lists are pre-hydrated to save round-trips.
- Conflating cones with the lattice as a whole. There is no global minimum of Inc(B) — "the minimum incarnation" is always cone-relative. Cross-cone joins / meets are undefined (returned as \`cross-cone-rejected\`, not an error).
- Hand-constructing \`canonicalText\` for \`bind_participant_to_design\`. It must be the exact \`JSON.stringify({text:…})\` output of the canonicalization pipeline; copy the pre-computed value from \`list_bindable_moves[].candidateDialogueMoves[].canonicalText\` rather than building it yourself.
- Reporting \`participantId\` in any read response. T4 non-attribution: it is stored but never surfaced; do not echo it back to the user even when you supplied it as an input.
- Reporting a filed \`attack_argument\` as a "defeat" or "won" when its \`ratificationStatus\` is \`PROPOSED\`. It is filed, pending a human sign-off — the bot cannot ratify its own attack. Say "filed, pending sign-off".
- Treating a \`post_dialogue_move\` R-code (R3_SELF_REPLY, MOVE_ILLEGAL, …) as a crash. It is a structured legality verdict — read \`code\`, correct, retry. Likewise \`CONTRADICTION_DETECTED\` is a deliberate refusal, not an error.
- Spinning up multiple \`speakAs\` personae to manufacture many-sided "agreement". Nothing structurally caps personae, but it is a misuse — use distinct sides only for genuine opposing positions or steelmanning.
`;

/**
 * Stable content hash for the orientation payload, derived from the
 * version + payload string. Lets clients cache across sessions.
 *
 * Implementation: simple FNV-1a over the version+payload to avoid a
 * crypto dep in this small package. Stable across runs as long as the
 * inputs don't change.
 */
export function computeOrientationContentHash(): string {
  const input = `${ORIENTATION_VERSION}\n${ORIENTATION_PAYLOAD}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a-${hash.toString(16).padStart(8, "0")}`;
}
