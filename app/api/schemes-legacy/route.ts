// app/api/schemes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FieldZ = z.object({
  name: z.string().min(1),                        // dot path ok
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'url', 'number', 'boolean']),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
});

const SchemeZ = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  fields: z.array(FieldZ),
});

const FALLBACK: z.infer<typeof SchemeZ>[] = [
  {
    key: 'expert_opinion',
    label: 'Expert Opinion',
    fields: [
      { name: 'expert.name',  label: 'Expert name',        type: 'text',     required: true },
      { name: 'expert.field', label: 'Domain/field',       type: 'text',     required: true },
      { name: 'statement',    label: 'Statement asserted', type: 'text',     required: true },
      { name: 'sourceUri',    label: 'Source URL',         type: 'url' },
    ],
  },
  {
    key: 'analogy',
    label: 'Analogy',
    fields: [
      { name: 'statement',     label: 'Claim (target)',   type: 'text',     required: true },
      { name: 'analogue',      label: 'Analogue case',    type: 'text',     required: true },
      { name: 'similarities',  label: 'Key similarities', type: 'textarea' },
      { name: 'sourceUri',     label: 'Source URL',       type: 'url' },
    ],
  },
  {
    key: 'good_consequences',
    label: 'Good Consequences',
    fields: [
      { name: 'statement', label: 'Claim/Policy',  type: 'text',     required: true },
      { name: 'benefits',  label: 'Benefits',      type: 'textarea', required: true },
      { name: 'sourceUri', label: 'Source URL',    type: 'url' },
    ],
  },
];

function ok<T>(val: unknown, schema: z.ZodType<T>): T | null {
  const r = schema.safeParse(val);
  return r.success ? r.data : null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const keyFilter = url.searchParams.get('key')?.trim();

  try {
    // If you have a Scheme table: { key, name, fieldsJson jsonb }
    // If not, this will throw; we’ll fall back below.
    const rows: Array<{ key: string; name: string | null; fieldsJson: unknown }> =
      await (prisma as any).scheme.findMany({
        select: { key: true, name: true, fieldsJson: true },
        orderBy: { name: 'asc' },
      });

    // Map + validate DB rows
    const dbDefs = rows
      .map((r) => ({
        key: r.key,
        label: r.name ?? r.key,
        fields: Array.isArray(r.fieldsJson) ? r.fieldsJson : [],
      }))
      .map((d) => ok(d, SchemeZ))
      .filter(Boolean) as z.infer<typeof SchemeZ>[];

    // Merge: DB overrides fallback by key
    const merged = new Map<string, z.infer<typeof SchemeZ>>();
    for (const f of FALLBACK) merged.set(f.key, f);
    for (const d of dbDefs) merged.set(d.key, d);

    // Optional filter by key
    if (keyFilter) {
      const one = merged.get(keyFilter);
      if (!one) {
        return new NextResponse(JSON.stringify({ schemes: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new NextResponse(JSON.stringify({ schemes: [one] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Sort by label for stable UX
    const out = Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));

    return new NextResponse(JSON.stringify({ schemes: out }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    // Fallback (and keep the API stable)
    console.warn('[GET /api/schemes] fallback', e?.message ?? e);
    const pool = keyFilter ? FALLBACK.filter(s => s.key === keyFilter) : FALLBACK;
    return new NextResponse(JSON.stringify({ schemes: pool }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
}