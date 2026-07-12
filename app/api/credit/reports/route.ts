export const dynamic = "force-dynamic";

/**
 * Institutional reports endpoint
 * POST - generate a new report
 * GET - list previous reports
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import {
  generateInstitutionalReport,
  getInstitutionalReports,
} from "@/lib/credit/institutionalReportService";

const GenerateReportSchema = z.object({
  reportType: z.enum([
    "FACULTY_CONTRIBUTIONS",
    "DEPARTMENT_SUMMARY",
    "INSTITUTION_OVERVIEW",
    "IMPACT_REPORT",
  ]),
  institutionId: z.string().optional(),
  departmentId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const institutionId = searchParams.get("institutionId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const reports = await getInstitutionalReports(institutionId, limit);

    return NextResponse.json(reports);
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const input = GenerateReportSchema.parse(body);

    const report = await generateInstitutionalReport(input.reportType, {
      institutionId: input.institutionId,
      departmentId: input.departmentId,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    });

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
