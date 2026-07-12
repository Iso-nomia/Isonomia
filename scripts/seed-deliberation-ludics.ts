// scripts/seed-deliberation-ludics.ts
import 'dotenv/config';

let _fetch: typeof fetch;
async function getFetch() {
  if (typeof (globalThis as any).fetch === 'function') return (globalThis as any).fetch as typeof fetch;
  const mod = await import('node-fetch'); return (mod.default as any) as typeof fetch;
}
type MovesList = { ok: boolean; items: Array<{ targetType?: string; targetId?: string }> };

type CLI = {
  deliberationId: string;
  host: string;
  noCompile: boolean;
  dry: boolean;
  cookie?: string;
    scenario?: 'E' | 'ex3';

};
function parseCLI(): CLI {
  const argv = process.argv.slice(2);
  const out: CLI = {
    deliberationId: '',
    host: process.env.SEED_HOST || 'http://localhost:3000',
    noCompile: false,
    dry: false,
    cookie: process.env.SEED_COOKIE,
    scenario: 'E',
  };

  // Accept positional deliberationId OR --deliberationId
  const positional = argv.find(a => !a.startsWith('--'));
  if (positional && !out.deliberationId) out.deliberationId = positional;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deliberationId') out.deliberationId = argv[++i];
    else if (a === '--host') out.host = argv[++i];
    else if (a === '--noCompile') out.noCompile = true;
    else if (a === '--dry') out.dry = true;
    else if (a === '--cookie') out.cookie = argv[++i];
      else if (a === '--scenario') out.scenario = (argv[++i] as any) || 'E';

  }
  if (!out.scenario) out.scenario = 'E';

  if (!out.deliberationId) {
    console.error('Usage: --deliberationId <ID> [--host http://localhost:3000] [--noCompile] [--dry] [--cookie "k=v; ..."]');
    console.error('       (or positional) scripts/seed-deliberation-ludics.ts <ID>');
    process.exit(1);
  }
  return out;
}

type MoveKind = 'ASSERT'|'WHY'|'GROUNDS'|'RETRACT'|'CONCEDE'|'CLOSE';
type MoveResp = { ok: boolean; move?: { id: string }; error?: string };
type LegalMovesResp = { ok: boolean; moves: Array<{ kind: MoveKind; payload?: any }>; daimonHints?: Array<{ locusPath: string}> };

async function seedBehaviour_E(
  BASE: string,
  headers: (extra?: Record<string,string>) => Record<string,string>,
  cfg: CLI
) {
  section('Scenario E (regular tensor ⊗ of two alien positives)');

  // ❶ Root argument that will carry the two alien branches (1 and 2)
  const argE = await createArgument(
    BASE, headers, cfg,
    'E: pursue Track-1 and Track-2 jointly (⊗).'
  );

  // Branch 1 ≈ ´ξ1 ˆξ10 1ξ100  (we just mirror the *shape* with loci/text)
  await postMove(BASE, headers, cfg, argE, 'ASSERT',  { expression: 'Track-1: adopt step 10 leading to outcome 100.', locusPath: '0.1' });
  await postMove(BASE, headers, cfg, argE, 'WHY',     { expression: 'Why is Track-1 warranted?', locusPath: '0.1' });
  await postMove(BASE, headers, cfg, argE, 'GROUNDS', { expression: 'Step 10 certifies requirement; outcome 100 follows.', locusPath: '0.1' });

  // Branch 2 ≈ ´ξ2 ˆξ20 1ξ200
  await postMove(BASE, headers, cfg, argE, 'ASSERT',  { expression: 'Track-2: adopt step 20 leading to outcome 200.', locusPath: '0.2' });
  await postMove(BASE, headers, cfg, argE, 'WHY',     { expression: 'Why is Track-2 warranted?', locusPath: '0.2' });

  // --- Interleave (shuffle) the answers across the branches ---
  // Answer branch-2 first, then ask another focused WHY on branch-1 and answer it.
  await postMove(BASE, headers, cfg, argE, 'GROUNDS', { expression: 'Step 20 certifies requirement; outcome 200 follows.', locusPath: '0.2' });
  await inspectLegalMoves(BASE, headers, cfg, argE, '0.1');  // see what’s legal on 0.1 now
  await inspectLegalMoves(BASE, headers, cfg, argE, '0.2');

  // Surrender both branches (as in a regular tensor, both sides can close cleanly after acceptance)
  await postMove(BASE, headers, cfg, argE, 'CONCEDE', { expression: 'Accept Track-1 argument.', locusPath: '0.1' });
  await postMove(BASE, headers, cfg, argE, 'CONCEDE', { expression: 'Accept Track-2 argument.', locusPath: '0.2' });

  // Now † should be hinted for each branch; attempt CLOSE if legal
  await closeIfPossible(BASE, headers, cfg, argE, '0.1');
  await closeIfPossible(BASE, headers, cfg, argE, '0.2');

  // Optionally check root † (depends on your stepper’s daimon hints)
  await inspectLegalMoves(BASE, headers, cfg, argE, '0');
}

async function seedExample3_1_NonVisitableShuffle(
  BASE: string,
  headers: (extra?: Record<string,string>) => Record<string,string>,
  cfg: CLI
) {
  section('Scenario Example 3.1 (non-visitable shuffle)');
  const argX = await createArgument(
    BASE, headers, cfg,
    'EX3: Two independent lines whose naive interleaving fails (∼q not a path).'
  );

  // Build line p1 on branch 2 first (mirroring (+ ξ {1,2})(− ξ2)(+ ξ20)(− ξ200)(+ ξ21)... shape in text/loci)
  await postMove(BASE, headers, cfg, argX, 'ASSERT',  { expression: 'Branch-2: premise 20, consequence 21.', locusPath: '0.2' });
  await postMove(BASE, headers, cfg, argX, 'WHY',     { expression: 'Why does 20 support 21?', locusPath: '0.2' });
  await postMove(BASE, headers, cfg, argX, 'GROUNDS', { expression: 'Grounds for 20→21.', locusPath: '0.2' });

  // Build line p2 on branch 1: (+ ξ {1,2})(− ξ1)(+ ξ10)(− ξ100)(+ ξ1000) in our idiom
  await postMove(BASE, headers, cfg, argX, 'ASSERT',  { expression: 'Branch-1: premise 10, consequence 1000.', locusPath: '0.1' });
  await postMove(BASE, headers, cfg, argX, 'WHY',     { expression: 'Why does 10 support 1000?', locusPath: '0.1' });
  await postMove(BASE, headers, cfg, argX, 'GROUNDS', { expression: 'Grounds for 10→1000.', locusPath: '0.1' });

  // Interleave in the "bad" order to emulate q (the paper’s shuffle whose dual breaks)
  // Practically: ask another WHY on branch-2 focusing a sub‑premise after answering branch‑1,
  // then try to CLOSE; visitability should fail → no CLOSE.
  await postMove(BASE, headers, cfg, argX, 'WHY',     { expression: 'Further doubt on 21’s warrant (forces non-reversible order).', locusPath: '0.2' });

  // Snapshot legal moves and † hints
  await inspectLegalMoves(BASE, headers, cfg, argX, '0.2');
  await closeIfPossible(BASE, headers, cfg, argX, '0.2');  // expect "not legal"

  // Sanity: each branch individually can be conceded
  await postMove(BASE, headers, cfg, argX, 'CONCEDE', { expression: 'Accept Branch-1 argument.', locusPath: '0.1' });
  await postMove(BASE, headers, cfg, argX, 'CONCEDE', { expression: 'Accept Branch-2 partial argument.', locusPath: '0.2' });

  // But after the bad interleaving, † at the conflicted locus should still be absent
  await inspectLegalMoves(BASE, headers, cfg, argX, '0.2');
}


async function run() {
  _fetch = await getFetch();
  const cfg = parseCLI();
  const BASE = cfg.host.replace(/\/+$/, '');
  const headers = (extra?: Record<string,string>) => ({
    'content-type': 'application/json',
    ...(cfg.cookie ? { cookie: cfg.cookie } : {}),
    ...(extra || {}),
  });

  banner('LUDICS SEEDER');
  info(`deliberationId: ${cfg.deliberationId}`);
  info(`host: ${BASE}`);
  if (cfg.cookie) info('Using Cookie auth.');

    if (cfg.scenario === 'E') {
    await seedBehaviour_E(BASE, headers, cfg);
  } else if (cfg.scenario === 'ex3') {
    await seedExample3_1_NonVisitableShuffle(BASE, headers, cfg);
  }

  if (!cfg.noCompile) await compileAndStep(BASE, headers, cfg);
  success('Behaviours seed complete.');

  // 1) Create real Arguments via your API
  const argA = await createArgument(BASE, headers, cfg, 'If congestion fees rise, peak-hour traffic will drop.');
  const argB = await createArgument(BASE, headers, cfg, 'Surge pricing harms low-income commuters.');
  const argC = await createArgument(BASE, headers, cfg, 'Either (expand buses) or (expand lanes), but not both.');
  const argD = await createArgument(BASE, headers, cfg, 'For all cities x, if x adopts congestion pricing, emissions fall.');
  success(`Arguments: ${argA}, ${argB}, ${argC}, ${argD}`);

  // 2) Seed dialogue threads on each Argument (locus 0)
  await seedThread(BASE, headers, cfg, argA, {
    assertion: 'Stockholm trial suggests ~20% peak reduction.',
    cq: 'What is the empirical basis?',
    grounds: 'RCT: Stockholm 2006 reduced peak flow ~20%.',
    locusPath: '0',
  });

  await seedThread(BASE, headers, cfg, argB, {
    assertion: 'Price elasticity differs by income.',
    cq: 'Why does surge pricing harm low-income commuters?',
    grounds: 'Study: fare hikes reduce trips by 10-15% among low-income riders.',
    locusPath: '0',
  });

  await seedThread(BASE, headers, cfg, argC, {
    assertion: 'Either expand buses or expand lanes (exclusive).',
    cq: 'Why exactly can’t we do both?',
    grounds: 'Budget model shows mutual exclusivity; opportunity costs double-counted.',
    locusPath: '0',
  });

  await seedThread(BASE, headers, cfg, argD, {
    assertion: 'For every city x: congestion → reduction in emissions.',
    cq: 'Give a concrete city witness?',
    grounds: 'Meta-analysis (N=27): avg −12% PM2.5 after policy adoption.',
    locusPath: '0',
  });

  // 3) Optional compile/step poke
  if (!cfg.noCompile) await compileAndStep(BASE, headers, cfg);

  success('Seed complete. Open the deliberation in DeepDive → LudicsPanel/DialogicalPanel.');
}


// --- replace createArgument with this version ---
async function createArgument(
  BASE: string,
  headers: (extra?: Record<string,string>) => Record<string,string>,
  cfg: CLI,
  text: string
): Promise<string> {
  if (cfg.dry) return `dry:${Math.random().toString(36).slice(2)}`;

  const url = `${BASE}/api/deliberations/${encodeURIComponent(cfg.deliberationId)}/arguments`;
  const body = { text };

  const r = await _fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });

  // If API is protected and cookie is wrong, you'll get 401 but still r.ok=false.
  // We throw with details so it's easy to fix.
  if (!r.ok) {
    const txt = await r.text().catch(()=>`${r.status}`);
    console.error(`\n[arguments:create] HTTP ${r.status}`);
    console.error(txt);
    console.error('\nTry with an auth cookie, e.g.:');
    console.error(`curl -i '${url}' -H 'content-type: application/json' -H 'Cookie: ${cfg.cookie ?? "<your cookie>"}' --data '${JSON.stringify(body)}'`);
    // Fallback to existing arguments in the dialogue so the seed can still proceed:
    const fallback = await findExistingArgument(BASE, headers, cfg);
    if (fallback) {
      console.warn(`[arguments:create] falling back to existing argument ${fallback}`);
      return fallback;
    }
    throw new Error(`/arguments create failed and no existing arguments found.`);
  }

  // Try to parse the response as JSON and pick an id in several shapes.
  let rawText = '';
  let j: any = null;
  try { rawText = await r.text(); j = JSON.parse(rawText); } catch {
    // Not JSON? Try Location header
    const loc = r.headers.get('location');
    if (loc) {
      const id = loc.split('/').filter(Boolean).pop();
      if (id) return id;
    }
    console.error(`[arguments:create] Non-JSON response:\n${rawText}`);
    const fallback = await findExistingArgument(BASE, headers, cfg);
    if (fallback) {
      console.warn(`[arguments:create] falling back to existing argument ${fallback}`);
      return fallback;
    }
    throw new Error('No argument id returned.');
  }

  // Common shapes: {argument:{id}}, {id}, {argumentId}
  const id = j?.argument?.id ?? j?.id ?? j?.argumentId;
  if (id) return id;

  // Some backends return {ok:true, argument:{...}} but with different casing
  const maybeId = (() => {
    const k = Object.keys(j || {});
    // pick first value with an id field
    for (const key of k) {
      const v = j[key];
      if (v && typeof v === 'object' && typeof v.id === 'string') return v.id;
    }
    return null;
  })();

  if (maybeId) return maybeId;

  console.error(`[arguments:create] Unexpected JSON response:\n${rawText}`);
  const fallback = await findExistingArgument(BASE, headers, cfg);
  if (fallback) {
    console.warn(`[arguments:create] falling back to existing argument ${fallback}`);
    return fallback;
  }
  throw new Error('No argument id returned.');
}

async function seedThread(
  BASE: string,
  headers: (extra?: Record<string,string>) => Record<string,string>,
  cfg: CLI,
  targetArgumentId: string,
  opts: { assertion: string; cq: string; grounds: string; locusPath: string }
) {
  section(`Target argument ${targetArgumentId}`);

  await postMove(BASE, headers, cfg, targetArgumentId, 'ASSERT', { expression: opts.assertion, locusPath: opts.locusPath });
  await postMove(BASE, headers, cfg, targetArgumentId, 'WHY', { expression: opts.cq, locusPath: opts.locusPath });
  await postMove(BASE, headers, cfg, targetArgumentId, 'GROUNDS', { expression: opts.grounds, locusPath: opts.locusPath });

  await inspectLegalMoves(BASE, headers, cfg, targetArgumentId, opts.locusPath);

  // Optional surrender then CLOSE if legal
  await postMove(BASE, headers, cfg, targetArgumentId, 'CONCEDE', { expression: 'Conceded.', locusPath: opts.locusPath });
  await closeIfPossible(BASE, headers, cfg, targetArgumentId, opts.locusPath);
}

async function postMove(
  BASE: string,
  headers: (extra?: Record<string,string>) => Record<string,string>,
  cfg: CLI,
  targetArgumentId: string,
  kind: MoveKind,
  payload: any
): Promise<MoveResp> {
  if (cfg.dry) { info(`DRY ${kind} ${JSON.stringify(payload)}`); return { ok: true }; }
  const url = `${BASE}/api/dialogue/move`;
  const body = {
    deliberationId: cfg.deliberationId,
    targetType: 'argument',
    targetId: targetArgumentId,
    kind,
    payload,
    autoCompile: true,
    autoStep: true,
    phase: 'neutral',
  };
  const r = await _fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const j = await r.json().catch(()=>({ ok:false })) as MoveResp;
  if (j.ok) success(`POST ${kind} ✓ ${j.move?.id ?? ''}`);
  else warn(`POST ${kind} failed: ${j.error ?? r.status}`);
  return j;
}

async function inspectLegalMoves(
  BASE: string,
  headers: (extra?: Record<string,string>) => Record<string,string>,
  cfg: CLI,
  targetArgumentId: string,
  locusPath: string
) {
  const url = `${BASE}/api/dialogue/legal-moves?` + new URLSearchParams({
    deliberationId: cfg.deliberationId,
    targetType: 'argument',
    targetId: targetArgumentId,
    locusPath,
  });
  const r = await _fetch(url, { headers: headers() });
  if (!r.ok) { warn(`legal-moves ${r.status}`); return; }
  const j = await r.json() as LegalMovesResp;
  info(`legal-moves@${locusPath}: [${(j.moves||[]).map(m=>m.kind).join(', ')}]`);
  const z = (j as any).daimonHints?.map((h:any)=>h.locusPath) ?? [];
  info(z.length ? `† hints at: ${z.join(', ')}` : '† hints: none');
}

async function closeIfPossible(
  BASE: string,
  headers: (extra?: Record<string,string>) => Record<string,string>,
  cfg: CLI,
  targetArgumentId: string,
  locusPath: string
) {
  const url = `${BASE}/api/dialogue/legal-moves?` + new URLSearchParams({
    deliberationId: cfg.deliberationId,
    targetType: 'argument',
    targetId: targetArgumentId,
    locusPath,
  });
  const r = await _fetch(url, { headers: headers() });
  if (!r.ok) return;
  const j = await r.json() as LegalMovesResp;
  const canClose = (j.moves||[]).some(m => m.kind === 'CLOSE');
  if (canClose) {
    info(`CLOSE legal at ${locusPath} — posting CLOSE.`);
    await postMove(BASE, headers, cfg, targetArgumentId, 'CLOSE', { locusPath });
  } else {
    warn(`CLOSE not legal at ${locusPath}.`);
  }
}

async function compileAndStep(
  BASE: string,
  headers: (extra?: Record<string,string>) => Record<string,string>,
  cfg: CLI
) {
  // Prefer your compile-step endpoint if present; fall back to step.
  try {
    const u = `${BASE}/api/ludics/compile-step`;
    const r = await _fetch(u, { method:'POST', headers: headers(), body: JSON.stringify({ deliberationId: cfg.deliberationId, phase: 'neutral' }) });
    if (r.ok) { const j = await r.json().catch(()=>({})); info(`compile-step: ${j?.step?.status ?? 'ok'}`); return; }
  } catch {}
  try {
    const u2 = `${BASE}/api/ludics/step`;
    const r2 = await _fetch(u2, { method:'POST', headers: headers(), body: JSON.stringify({ dialogueId: cfg.deliberationId, phase:'neutral', maxPairs:1024 }) });
    info(`step: ${r2.status}`);
  } catch {}
}

// --- add this fallback helper anywhere below run() ---
async function findExistingArgument(
  BASE: string,
  headers: (extra?: Record<string,string>) => Record<string,string>,
  cfg: CLI
): Promise<string | null> {
  try {
    const url = `${BASE}/api/deliberations/${encodeURIComponent(cfg.deliberationId)}/moves`;
    const r = await _fetch(url, { headers: headers() });
    if (!r.ok) return null;
    const j = await r.json() as MovesList;
    if (!j?.items?.length) return null;
    // Find any move that targets an argument
    const m = j.items.find(x => (x.targetType ?? '').toLowerCase() === 'argument' && typeof x.targetId === 'string');
    return m?.targetId ?? null;
  } catch {
    return null;
  }
}

// Logging helpers
function banner(s: string) { console.log(`\n=== ${s} ===`); }
function section(s: string) { console.log(`\n— ${s}`); }
function info(s: string) { console.log(`  • ${s}`); }
function warn(s: string) { console.log(`  ! ${s}`); }
function success(s: string) { console.log(`  ✓ ${s}`); }

run().catch((e) => { console.error(e); process.exit(1); });
