/**
 * lib/aif/version.ts
 *
 * Single-source-of-truth version pin for AIF (Argument Interchange Format)
 * serialisation across Mesh's import/export boundary.
 *
 * ── Q-023 decision (folksonomy roadmap step 16) ───────────────────────────
 *
 * We pin a SINGLE version of the AIF ontology and a SINGLE Mesh serialisation
 * profile, rather than building a multi-version translator at the boundary.
 *
 * Rationale:
 *   • Mesh is currently the only producer and the only consumer of these
 *     documents. The interchange surface is internal (export → re-import,
 *     and AIF-aware tooling we control).
 *   • A multi-version translator is YAGNI until a second emitter exists.
 *     When that day comes, the migration story is:
 *         (1) bump `MESH_AIF_PROFILE_VERSION` here,
 *         (2) add a `translateProfile(from, to, doc)` shim,
 *         (3) call it from the import path before validation.
 *     None of which is blocked by the current pin.
 *
 * Two version axes are stamped on every interchange document:
 *
 *   • `aifVersion`            — the AIF Core ontology revision we conform to.
 *                               Pinned to "AIF-Core-2011" (Bex, Modgil,
 *                               Prakken & Reed 2013, "On logical
 *                               specifications of the Argument Interchange
 *                               Format", J. Logic Comput.). The Dundee
 *                               namespace `http://www.arg.dundee.ac.uk/aif`
 *                               is unchanged from earlier publications.
 *
 *   • `meshAifProfile`        — Mesh's profile of AIF Core: which optional
 *                               extensions we emit (`as:hasCriticalQuestion`,
 *                               `as:appliesSchemeKey`, `aif:L`/`aif:illocutes`
 *                               for locutions, `mesh:behaviourFingerprint`
 *                               on RA nodes, etc.). Pinned at "1.0".
 *
 * Both stamps are required on every import. A mismatch is hard-rejected
 * (HTTP 422) — silent translation across versions is exactly the failure
 * mode this pin exists to prevent.
 *
 * Conservative back-compat: documents that LACK either stamp are treated as
 * "legacy/unstamped" and accepted only when the caller passes the explicit
 * `allowUnstamped: true` escape hatch (used by `/api/aif/batch` in
 * `validate` mode for tooling that hasn't been upgraded yet). Upsert/import
 * paths NEVER accept unstamped documents.
 */

/** Pinned AIF Core ontology revision. Do not bump without a migration plan. */
export const AIF_CORE_VERSION = "AIF-Core-2011" as const;

/** Pinned Mesh AIF serialisation profile. Bump on incompatible profile changes. */
export const MESH_AIF_PROFILE_VERSION = "1.0" as const;

export type AifVersionStamp = {
  aifVersion: typeof AIF_CORE_VERSION;
  meshAifProfile: typeof MESH_AIF_PROFILE_VERSION;
};

/** Stamp object to splat into every export document. */
export const AIF_VERSION_STAMP: AifVersionStamp = Object.freeze({
  aifVersion: AIF_CORE_VERSION,
  meshAifProfile: MESH_AIF_PROFILE_VERSION,
});

export type AifVersionCheckResult =
  | { ok: true; aifVersion: string; meshAifProfile: string }
  | { ok: false; code: "missing_stamp" | "aif_version_mismatch" | "profile_mismatch"; got: { aifVersion?: unknown; meshAifProfile?: unknown }; expected: AifVersionStamp; message: string };

/**
 * Validate the version stamp on an incoming AIF interchange document.
 *
 * @param doc            The parsed JSON document. We read `aifVersion` and
 *                       `meshAifProfile` off the top level.
 * @param allowUnstamped When true, a document missing both fields is treated
 *                       as `ok` (caller is responsible for downgrading the
 *                       outcome — e.g. emitting a warning in `validate`
 *                       mode). Defaults to false.
 */
export function checkAifVersionStamp(
  doc: unknown,
  allowUnstamped = false,
): AifVersionCheckResult {
  const got = (doc && typeof doc === "object")
    ? {
        aifVersion: (doc as Record<string, unknown>).aifVersion,
        meshAifProfile: (doc as Record<string, unknown>).meshAifProfile,
      }
    : { aifVersion: undefined, meshAifProfile: undefined };

  const hasAny = got.aifVersion !== undefined || got.meshAifProfile !== undefined;

  if (!hasAny) {
    if (allowUnstamped) {
      return { ok: true, aifVersion: "", meshAifProfile: "" };
    }
    return {
      ok: false,
      code: "missing_stamp",
      got,
      expected: AIF_VERSION_STAMP,
      message: `AIF interchange document is missing required version stamp. Expected aifVersion="${AIF_CORE_VERSION}" and meshAifProfile="${MESH_AIF_PROFILE_VERSION}".`,
    };
  }

  if (got.aifVersion !== AIF_CORE_VERSION) {
    return {
      ok: false,
      code: "aif_version_mismatch",
      got,
      expected: AIF_VERSION_STAMP,
      message: `AIF version mismatch. Expected "${AIF_CORE_VERSION}", got ${JSON.stringify(got.aifVersion)}.`,
    };
  }

  if (got.meshAifProfile !== MESH_AIF_PROFILE_VERSION) {
    return {
      ok: false,
      code: "profile_mismatch",
      got,
      expected: AIF_VERSION_STAMP,
      message: `Mesh AIF profile mismatch. Expected "${MESH_AIF_PROFILE_VERSION}", got ${JSON.stringify(got.meshAifProfile)}.`,
    };
  }

  return { ok: true, aifVersion: AIF_CORE_VERSION, meshAifProfile: MESH_AIF_PROFILE_VERSION };
}
