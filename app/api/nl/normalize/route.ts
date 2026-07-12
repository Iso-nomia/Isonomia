export const dynamic = "force-dynamic";

// app/api/nl/normalize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const Body = z.object({ text: z.string().min(1), domain: z.string().optional() });

const STOP = /\b(is|are|the|a|an|of|to|for|in|on|with|has|have|will|be|this|that|very)\b/gi;
const slug = (s:string) => s.toLowerCase().replace(STOP,' ').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');

function parseRule(s: string) {
  const raw = s.trim();
  const sep = raw.includes('->') ? '->' : (raw.includes('=>') ? '=>' : null);
  if (!sep) return null;
  const [lhs, rhs] = raw.split(sep);
  const ifAll = (lhs ?? '').split(/[,=&]| and /i).map(slug).filter(Boolean);
  const then  = slug(rhs ?? '');
  if (!ifAll.length || !then) return null;
  return { ifAll, then };
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status:400 });
  const { text } = parsed.data;

  // basic rule vs fact detection
  const ruleParsed = parseRule(text);
  if (ruleParsed) {
    return NextResponse.json({
      ok:true, kind:'rule', canonical: `${ruleParsed.ifAll.join(' & ')} -> ${ruleParsed.then}`,
      tokens: ruleParsed, confidence: 0.85
    });
  }

  const label = slug(text);
  // TODO: check label dictionary + embedding suggestions here
  const suggestions = [label]; // placeholder
  return NextResponse.json({
    ok:true, kind:'fact', canonical: suggestions[0], suggestions, confidence: 0.7
  });
}
