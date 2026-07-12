// __tests__/invariants/t4-anonymity-primitive.test.ts
//
// T4 non-attribution — the reusable anonymity primitive (Reading-C roadmap item 3).
//
// Companion to t4-non-attribution.test.ts (the witnessing-layer service tests).
// This file pins the shared `lib/ludics/anonymity.ts` primitive that the new
// Reading-C acceptability surfaces (items 1/2/4) adopt: it strips the PERSON id
// (`participantId` / `authorId`) on a default read and PRESERVES the role polarity
// label `"Proponent" | "Opponent"`.
//
// Spec: docs/READING_C_ITEM3_ANONYMISATION_DEV_SPEC.md

import { describe, it, expect } from "@jest/globals";

import {
  stripIdentity,
  stripIdentityAll,
  type Anonymous,
} from "@/lib/ludics/anonymity";

// ─── Type-level T4 assertions ────────────────────────────────────────────────
// Fail the build if a person-identity field ever survives in `Anonymous<…>`.

type RowWithIdentity = {
  id: string;
  participantId: string;
  authorId: string;
  role: "Proponent" | "Opponent";
  endedAtDaimonForParticipantId: "Proponent" | "Opponent";
};

type AssertNoParticipantId =
  "participantId" extends keyof Anonymous<RowWithIdentity> ? never : true;
const _noParticipantId: AssertNoParticipantId = true;
void _noParticipantId;

type AssertNoAuthorId =
  "authorId" extends keyof Anonymous<RowWithIdentity> ? never : true;
const _noAuthorId: AssertNoAuthorId = true;
void _noAuthorId;

// The role + role-attribution siblings MUST survive (they are polarity, not identity).
type AssertRoleSurvives =
  "role" extends keyof Anonymous<RowWithIdentity> ? true : never;
const _roleSurvives: AssertRoleSurvives = true;
void _roleSurvives;

type AssertRoleAttributionSurvives =
  "endedAtDaimonForParticipantId" extends keyof Anonymous<RowWithIdentity> ? true : never;
const _roleAttrSurvives: AssertRoleAttributionSurvives = true;
void _roleAttrSurvives;

// ─── Runtime behaviour ───────────────────────────────────────────────────────

const row: RowWithIdentity = {
  id: "design_1",
  participantId: "user_secret_should_not_leak",
  authorId: "user_secret_should_not_leak",
  role: "Proponent",
  endedAtDaimonForParticipantId: "Opponent",
};

describe("stripIdentity — T4 person-id removal", () => {
  it("drops participantId and authorId", () => {
    const out = stripIdentity(row);
    expect(out).not.toHaveProperty("participantId");
    expect(out).not.toHaveProperty("authorId");
  });

  it("preserves the role label and the role-attribution sibling", () => {
    const out = stripIdentity(row);
    expect(out.role).toBe("Proponent");
    // The verdict's role attribution is NOT identity — it must survive.
    expect(out.endedAtDaimonForParticipantId).toBe("Opponent");
    expect(out.id).toBe("design_1");
  });

  it("is a no-op on a row that already carries no identity", () => {
    const clean = { id: "x", role: "Opponent" as const };
    expect(stripIdentity(clean)).toEqual(clean);
  });

  it("stripIdentityAll maps over a list", () => {
    const out = stripIdentityAll([row, row]);
    expect(out).toHaveLength(2);
    for (const r of out) {
      expect(r).not.toHaveProperty("participantId");
      expect(r).not.toHaveProperty("authorId");
      expect(r.role).toBe("Proponent");
    }
  });
});
