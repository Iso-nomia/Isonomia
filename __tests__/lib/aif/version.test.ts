/**
 * __tests__/lib/aif/version.test.ts
 *
 * Q-023 (folksonomy roadmap step 16): every AIF interchange document MUST
 * carry an explicit version stamp. This suite locks the contract on
 * `lib/aif/version.ts`'s `checkAifVersionStamp` validator that gates
 * the import paths.
 */

import {
  AIF_CORE_VERSION,
  AIF_VERSION_STAMP,
  MESH_AIF_PROFILE_VERSION,
  checkAifVersionStamp,
} from "@/lib/aif/version";

describe("AIF version pin (Q-023)", () => {
  it("exposes the pinned constants", () => {
    expect(AIF_CORE_VERSION).toBe("AIF-Core-2011");
    expect(MESH_AIF_PROFILE_VERSION).toBe("1.0");
    expect(AIF_VERSION_STAMP).toEqual({
      aifVersion: "AIF-Core-2011",
      meshAifProfile: "1.0",
    });
  });

  it("accepts a document carrying the matching stamp", () => {
    const doc = { ...AIF_VERSION_STAMP, "@graph": [] };
    const r = checkAifVersionStamp(doc);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.aifVersion).toBe(AIF_CORE_VERSION);
      expect(r.meshAifProfile).toBe(MESH_AIF_PROFILE_VERSION);
    }
  });

  it("rejects a document with no stamp by default", () => {
    const r = checkAifVersionStamp({ "@graph": [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("missing_stamp");
  });

  it("accepts an unstamped document when allowUnstamped=true (validate-mode escape hatch)", () => {
    const r = checkAifVersionStamp({ "@graph": [] }, true);
    expect(r.ok).toBe(true);
  });

  it("rejects a document with mismatched aifVersion even when allowUnstamped=true", () => {
    // Once a stamp is present, version mismatch is hard-rejected regardless
    // of the legacy escape hatch — silent translation across versions is
    // exactly the failure mode Q-023 forbids.
    const r = checkAifVersionStamp(
      { aifVersion: "AIF-Core-2099", meshAifProfile: MESH_AIF_PROFILE_VERSION, "@graph": [] },
      true,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("aif_version_mismatch");
  });

  it("rejects a document with mismatched meshAifProfile", () => {
    const r = checkAifVersionStamp({
      aifVersion: AIF_CORE_VERSION,
      meshAifProfile: "0.9",
      "@graph": [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("profile_mismatch");
  });

  it("rejects a document carrying only one of the two stamps", () => {
    const r = checkAifVersionStamp({ aifVersion: AIF_CORE_VERSION, "@graph": [] });
    expect(r.ok).toBe(false);
    // Treated as profile mismatch (got undefined where 1.0 expected).
    if (!r.ok) expect(r.code).toBe("profile_mismatch");
  });

  it("rejects non-object documents", () => {
    const r = checkAifVersionStamp(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("missing_stamp");
  });
});
