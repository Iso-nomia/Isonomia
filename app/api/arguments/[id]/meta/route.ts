export const dynamic = "force-dynamic";

// app/api/arguments/[id]/meta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PUT as updateArg } from '../route'; // reuse the main PUT handler
export async function PUT(req: NextRequest, ctx: any) { return updateArg(req, ctx); }
