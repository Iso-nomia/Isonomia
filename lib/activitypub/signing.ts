// lib/activitypub/signing.ts
import { createHash, createHmac, createSign, createVerify } from "crypto";

export function sha256Base64(body: string) {
  return createHash("sha256").update(body).digest("base64");
}

export function makeDigest(body: string) {
  return `SHA-256=${sha256Base64(body)}`;
}

type SignParams = {
  url: URL;
  method: string; // GET/POST
  headers: Record<string, string>;
  body?: string;
  keyId: string;           // e.g., https://host/users/alice#main-key
  privateKeyPem: string;   // RSA private key (PKCS8 PEM)
  headerList?: string[];   // default ["(request-target)", "host", "date", "digest"]
};

export function httpSign({
  url,
  method,
  headers,
  body = "",
  keyId,
  privateKeyPem,
  headerList = ["(request-target)", "host", "date", "digest"],
}: SignParams) {
  const lines: string[] = [];
  for (const h of headerList) {
    if (h === "(request-target)") {
      lines.push(`(request-target): ${method.toLowerCase()} ${url.pathname}${url.search}`);
    } else if (h === "host") {
      lines.push(`host: ${url.host}`);
    } else if (h === "digest") {
      const digest = headers["digest"] || makeDigest(body);
      headers["digest"] = digest;
      lines.push(`digest: ${digest}`);
    } else {
      const v = headers[h] || headers[h.toLowerCase()];
      if (!v) throw new Error(`Missing header ${h} for signature`);
      lines.push(`${h.toLowerCase()}: ${v}`);
    }
  }
  const signingString = lines.join("\n");
  const signer = createSign("RSA-SHA256");
  signer.update(signingString);
  signer.end();
  const signature = signer.sign(privateKeyPem).toString("base64");

  headers["signature"] = `keyId="${keyId}",algorithm="rsa-sha256",headers="${headerList.join(
    " "
  )}",signature="${signature}"`;

  return headers;
}
 
 export function httpSignGet({
       url,
       headers,
       keyId,
       privateKeyPem,
       headerList = ["(request-target)", "host", "date"],
     }: {
       url: URL;
       headers: Record<string, string>;
       keyId: string;
       privateKeyPem: string;
       headerList?: string[];
     }) {
       const now = new Date().toUTCString();
       headers["date"] = headers["date"] || now;
       // re-use httpSign with empty body and no digest header in list
       return httpSign({ url, method: "GET", headers, body: "", keyId, privateKeyPem, headerList });
     }
     
     export async function signedFetchJson(
       input: string,
       {
         keyId,
         privateKeyPem,
         extraHeaders,
       }: { keyId: string; privateKeyPem: string; extraHeaders?: Record<string, string> }
     ) {
       const url = new URL(input);
       const headers: Record<string, string> = {
         accept: 'application/activity+json',
         host: url.host,
         ...(extraHeaders || {}),
       };
       httpSignGet({ url, headers, keyId, privateKeyPem });
       const r = await fetch(url.toString(), { method: "GET", headers });
       if (!r.ok) return null;
       try { return await r.json(); } catch { return null; }
     }

export function parseSignatureHeader(sig: string) {
  const out: Record<string, string> = {};
  sig.split(",").forEach((kv) => {
    const [k, v] = kv.split("=").map((s) => s.trim());
    out[k] = v?.replace(/^"|"$/g, "") ?? "";
  });
  return out;
}

export function verifySignature({
  method,
  url,
  headers,
  body,
  publicKeyPem,
  headerList,
  signatureB64,
}: {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: string;
  publicKeyPem: string;
  headerList: string[];
  signatureB64: string;
}) {
  const lines: string[] = [];
  for (const h of headerList) {
    if (h === "(request-target)") {
      lines.push(`(request-target): ${method.toLowerCase()} ${url.pathname}${url.search}`);
    } else if (h === "host") {
      lines.push(`host: ${url.host}`);
    } else if (h === "digest") {
      lines.push(`digest: ${headers["digest"] || headers["Digest"] || makeDigest(body)}`);
    } else {
      const v = headers[h] || headers[h.toLowerCase()];
      if (!v) return false;
      lines.push(`${h.toLowerCase()}: ${v}`);
    }
  }
  const signingString = lines.join("\n");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(signingString);
  verifier.end();
  return verifier.verify(publicKeyPem, Buffer.from(signatureB64, "base64"));
}
