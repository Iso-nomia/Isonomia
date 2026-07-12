/**
 * Phase 4.3: CV Export Service
 * Generates scholarly contribution exports in multiple formats
 */

import { prisma } from "@/lib/prismaclient";
import { CvEntry, CvExportOptions, CvExportFormat } from "./types";

/**
 * Generate CV export
 */
export async function generateCvExport(
  userId: bigint,
  options: CvExportOptions
): Promise<{ entries: CvEntry[]; formatted: string; fileName: string }> {
  // Gather contributions
  const entries = await gatherCvEntries(userId, options);

  // Format based on type
  let formatted: string;
  let fileName: string;

  switch (options.format) {
    case "JSON_LD":
      formatted = formatJsonLd(entries, userId);
      fileName = "contributions.jsonld";
      break;
    case "BIBTEX":
      formatted = formatBibTeX(entries);
      fileName = "contributions.bib";
      break;
    case "LATEX":
      formatted = formatLaTeX(entries);
      fileName = "contributions.tex";
      break;
    case "CSV":
      formatted = formatCsv(entries);
      fileName = "contributions.csv";
      break;
    default:
      formatted = JSON.stringify(entries, null, 2);
      fileName = "contributions.json";
  }

  // Record export
  await prisma.cvExport.create({
    data: {
      userId,
      format: options.format,
      dateRange: options.dateRange
        ? {
            start: options.dateRange.start.toISOString(),
            end: options.dateRange.end.toISOString(),
          }
        : undefined,
      includeTypes: options.includeTypes || [],
      fileName,
      contributionCount: entries.length,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return { entries, formatted, fileName };
}

/**
 * Gather CV entries from contributions
 */
async function gatherCvEntries(
  userId: bigint,
  options: CvExportOptions
): Promise<CvEntry[]> {
  const entries: CvEntry[] = [];

  const where: Record<string, unknown> = { userId };
  if (options.dateRange) {
    where.createdAt = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }
  if (options.includeTypes && options.includeTypes.length > 0) {
    where.type = { in: options.includeTypes };
  }

  // Get contributions
  const contributions = await prisma.scholarContribution.findMany({
    where,
    include: {
      deliberation: { select: { title: true } },
      argument: { select: { text: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get review completions
  const reviewWhere: Record<string, unknown> = {
    userId: userId.toString(), // ReviewerAssignment uses auth_id (string)
    status: "COMPLETED",
  };
  if (options.dateRange) {
    reviewWhere.completedAt = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }

  // Note: ReviewerAssignment uses auth_id string, so we need the user's auth_id
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { auth_id: true },
  });

  if (user) {
    const assignments = await prisma.reviewerAssignment.findMany({
      where: {
        userId: user.auth_id,
        status: "COMPLETED",
        ...(options.dateRange && {
          completedAt: {
            gte: options.dateRange.start,
            lte: options.dateRange.end,
          },
        }),
      },
      include: {
        review: { select: { targetTitle: true } },
      },
      orderBy: { completedAt: "desc" },
    });

    assignments.forEach((a) => {
      entries.push({
        type: "Peer Review",
        title: `Review: ${a.review.targetTitle}`,
        date: a.completedAt || a.assignedAt,
        context: a.review.targetTitle,
      });
    });
  }

  // Convert contributions to CV entries
  contributions.forEach((c) => {
    const entry = contributionToCvEntry(c);
    if (entry) entries.push(entry);
  });

  // Sort by date descending
  entries.sort((a, b) => b.date.getTime() - a.date.getTime());

  return entries;
}

/**
 * Convert contribution to CV entry
 */
function contributionToCvEntry(contribution: {
  type: string;
  createdAt: Date;
  argument?: { text: string } | null;
  deliberation?: { title: string | null } | null;
}): CvEntry | null {
  const typeLabels: Record<string, string> = {
    ARGUMENT_CREATED: "Scholarly Argument",
    CONSENSUS_ACHIEVED: "Consensus Contribution",
    ATTACK_INITIATED: "Critical Analysis",
    DEFENSE_PROVIDED: "Position Defense",
    CITATION_RECEIVED: "Citation",
    REVIEW_COMPLETED: "Peer Review",
    EVIDENCE_ADDED: "Evidence Contribution",
  };

  const label = typeLabels[contribution.type];
  if (!label) return null;

  return {
    type: label,
    title:
      contribution.argument?.text?.substring(0, 150) || contribution.type,
    date: contribution.createdAt,
    context: contribution.deliberation?.title ?? undefined,
  };
}

/**
 * Format as JSON-LD (Schema.org)
 */
function formatJsonLd(entries: CvEntry[], userId: bigint): string {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${process.env.NEXT_PUBLIC_APP_URL}/scholar/${userId}`,
    hasCredential: entries.map((entry) => ({
      "@type": "EducationalOccupationalCredential",
      credentialCategory: entry.type,
      name: entry.title,
      datePublished: entry.date.toISOString(),
      ...(entry.context && { description: `Context: ${entry.context}` }),
    })),
  };

  return JSON.stringify(jsonLd, null, 2);
}

/**
 * Format as BibTeX
 */
function formatBibTeX(entries: CvEntry[]): string {
  return entries
    .map((entry, index) => {
      const key = `contrib${index + 1}`;
      const year = entry.date.getFullYear();
      const month = entry.date
        .toLocaleString("en", { month: "short" })
        .toLowerCase();

      return `@misc{${key},
  title = {${escapeBibTeX(entry.title)}},
  year = {${year}},
  month = {${month}},
  note = {${entry.type}${entry.context ? ` in ${escapeBibTeX(entry.context)}` : ""}}
}`;
    })
    .join("\n\n");
}

function escapeBibTeX(text: string): string {
  return text.replace(/[{}&%$#_]/g, (match) => `\\${match}`);
}

/**
 * Format as LaTeX
 */
function formatLaTeX(entries: CvEntry[]): string {
  const sections: Record<string, CvEntry[]> = {};

  entries.forEach((entry) => {
    if (!sections[entry.type]) sections[entry.type] = [];
    sections[entry.type].push(entry);
  });

  let latex = `\\documentclass{article}
\\usepackage{enumitem}
\\begin{document}

\\section*{Scholarly Contributions}

`;

  Object.entries(sections).forEach(([type, items]) => {
    latex += `\\subsection*{${type}}\n\\begin{itemize}\n`;
    items.forEach((item) => {
      const date = item.date.toLocaleDateString("en", {
        year: "numeric",
        month: "short",
      });
      latex += `  \\item ${escapeLaTeX(item.title)} (${date})`;
      if (item.context) {
        latex += ` --- ${escapeLaTeX(item.context)}`;
      }
      latex += "\n";
    });
    latex += `\\end{itemize}\n\n`;
  });

  latex += `\\end{document}`;

  return latex;
}

function escapeLaTeX(text: string): string {
  return text.replace(/[&%$#_{}~^\\]/g, (match) => `\\${match}`);
}

/**
 * Format as CSV
 */
function formatCsv(entries: CvEntry[]): string {
  const headers = ["Type", "Title", "Date", "Context"];
  const rows = entries.map((e) => [
    e.type,
    `"${e.title.replace(/"/g, '""')}"`,
    e.date.toISOString().split("T")[0],
    e.context ? `"${e.context.replace(/"/g, '""')}"` : "",
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Get previous exports for a user
 */
export async function getUserExports(userId: bigint, limit = 10) {
  return prisma.cvExport.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
