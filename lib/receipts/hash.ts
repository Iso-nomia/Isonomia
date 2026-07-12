
import { createHash } from "crypto";
import { canonicalize } from "./jcs";

export function sha256Hex(buf: Buffer | string): string {
  const h = createHash("sha256");
  h.update(buf);
  return h.digest("hex");
}

export function versionHashOf(payload: any): string {
  const canon = canonicalize(payload);
  return `sha256:${sha256Hex(canon)}`;
}
