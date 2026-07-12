import rateLimit from "next-rate-limit";
import type { NextRequest } from "next/server";

const limiter = rateLimit({ uniqueTokenPerInterval: 500, interval: 60 * 1000 });

export const checkNext = (req: NextRequest, limit: number) => limiter.checkNext(req, limit);
// `check` is kept for backwards-compatibility with callers that pass a string
// key. The underlying library only exposes `checkNext`, so we delegate to it
// using a default limit.
export const check = (req: NextRequest, _key: string) => limiter.checkNext(req, 30);

export default { checkNext, check };
