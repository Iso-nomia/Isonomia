import { hexToBase32 } from './canonicalize';

export type EntityCode = 'clm'|'crd'|'brf';

export function mintUrn(entity: EntityCode, moidHex: string, semver?: string) {
  const base32 = hexToBase32(moidHex);
  return `urn:mesh:${entity}:${base32}${semver ? `:v${semver}` : ''}`;
}

export const urn = {
  claim: (id: string) => `urn:mesh:claim:${id}`,
  locus: (dialogueId: string, path: string) => `urn:mesh:locus:${dialogueId}:${path}`,
  articlePara: (articleId: string, n: number) => `urn:mesh:article:${articleId}#para=${n}`,
  libPage: (postId: string, page: number) => `urn:mesh:lib:${postId}#p=${page}`,
};