/**
 * AI-assisted Claim Extraction from Academic Sources
 * 
 * Phase 1.1: Paper-to-Claim Pipeline
 * 
 * Uses OpenAI GPT-4 to extract structured claims from academic text,
 * including claim classification, source location, and confidence scores.
 */

import OpenAI from "openai";
import { AcademicClaimType } from "@prisma/client";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ExtractedClaim {
  text: string;
  claimType: AcademicClaimType;
  supportingQuote?: string;
  pageNumber?: number;
  sectionName?: string;
  confidence: number;
  reasoning: string;
}

export interface ExtractionResult {
  claims: ExtractedClaim[];
  processingTime: number;
  tokensUsed: number;
}

export interface ExtractionOptions {
  maxClaims?: number;
  focusTypes?: AcademicClaimType[];
  sourceTitle?: string;
  includeReasoning?: boolean;
}

// ─────────────────────────────────────────────────────────
// OpenAI Client
// ─────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─────────────────────────────────────────────────────────
// System Prompts
// ─────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are an expert academic analyst specializing in identifying claims in scholarly papers. Your task is to extract specific, debatable claims from the provided text.

CLAIM TYPES:
- THESIS: The central argument or main claim of the work
- INTERPRETIVE: A reading or interpretation of a text, event, or phenomenon
- HISTORICAL: A factual claim about past events or conditions
- CONCEPTUAL: A definition, analysis, or clarification of a concept
- NORMATIVE: An evaluative or prescriptive claim (what ought to be)
- METHODOLOGICAL: A claim about how to study or analyze something
- COMPARATIVE: A claim relating or comparing two or more things
- CAUSAL: A claim about causation or causal mechanisms
- META: A claim about the field, debate, or scholarship itself
- EMPIRICAL: A claim based on data, observations, or experiments

GUIDELINES:
1. Extract SPECIFIC, DEBATABLE claims - not summaries or descriptions
2. Each claim should be a single proposition that could be defended or attacked
3. Prefer claims that are central to the argument, not trivial observations
4. Include the supporting quote from the text when possible (exact text if available)
5. Assign confidence based on how clearly the text states the claim (0.0-1.0)
6. Provide brief reasoning for why you identified this as a claim of this type
7. If the claim comes from a specific section, note the section name
8. Avoid extracting claims that are merely reporting others' views (unless framed as such)

OUTPUT FORMAT:
Return a JSON object with a "claims" array containing objects with these fields:
{
  "claims": [
    {
      "text": "The specific claim statement, written as a clear proposition",
      "claimType": "THESIS|INTERPRETIVE|HISTORICAL|CONCEPTUAL|NORMATIVE|METHODOLOGICAL|COMPARATIVE|CAUSAL|META|EMPIRICAL",
      "supportingQuote": "The exact text from the source that supports this claim",
      "sectionName": "Introduction|Literature Review|Methods|Results|Discussion|Conclusion|null if unclear",
      "confidence": 0.85,
      "reasoning": "Brief explanation of why this is classified as this type of claim"
    }
  ]
}`;

// ─────────────────────────────────────────────────────────
// Main Extraction Functions
// ─────────────────────────────────────────────────────────

/**
 * Extract claims from academic text using AI
 * 
 * @param text - The text to extract claims from
 * @param options - Extraction options
 * @returns Extracted claims with metadata
 */
export async function extractClaimsFromText(
  text: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const { 
    maxClaims = 10, 
    focusTypes, 
    sourceTitle,
    includeReasoning = true 
  } = options;
  
  const startTime = Date.now();

  // Build user prompt
  let userPrompt = `Extract up to ${maxClaims} claims from the following academic text.`;
  
  if (sourceTitle) {
    userPrompt += `\n\nSource Title: "${sourceTitle}"`;
  }
  
  if (focusTypes && focusTypes.length > 0) {
    userPrompt += `\n\nFocus particularly on these claim types: ${focusTypes.join(", ")}`;
  }
  
  userPrompt += `\n\n---\nTEXT:\n${text.slice(0, 15000)}`; // Limit to ~15k chars

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent extraction
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const parsed = JSON.parse(content);
    const claims: ExtractedClaim[] = (parsed.claims || []).map(
      (claim: any) => ({
        text: claim.text || "",
        claimType: validateClaimType(claim.claimType),
        supportingQuote: claim.supportingQuote || undefined,
        pageNumber: claim.pageNumber ? parseInt(claim.pageNumber) : undefined,
        sectionName: claim.sectionName || undefined,
        confidence: Math.max(0, Math.min(1, parseFloat(claim.confidence) || 0.5)),
        reasoning: includeReasoning ? (claim.reasoning || "") : "",
      })
    ).filter((c: ExtractedClaim) => c.text.length > 10); // Filter out empty/trivial claims

    return {
      claims,
      processingTime: Date.now() - startTime,
      tokensUsed: response.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error("Claim extraction failed:", error);
    throw error;
  }
}

/**
 * Extract claims from an abstract (quick extraction)
 * 
 * Optimized for abstracts - focuses on thesis and empirical claims
 */
export async function extractClaimsFromAbstract(
  abstract: string,
  sourceTitle: string
): Promise<ExtractionResult> {
  return extractClaimsFromText(abstract, {
    maxClaims: 5,
    focusTypes: [
      AcademicClaimType.THESIS, 
      AcademicClaimType.EMPIRICAL, 
      AcademicClaimType.CAUSAL
    ],
    sourceTitle,
  });
}

/**
 * Extract claims from full PDF text (comprehensive extraction)
 * 
 * Processes long documents in sections for better accuracy
 */
export async function extractClaimsFromFullText(
  fullText: string,
  sourceTitle: string
): Promise<ExtractionResult> {
  // For short texts, process in one go
  const MAX_SINGLE_PASS_LENGTH = 10000;
  
  if (fullText.length < MAX_SINGLE_PASS_LENGTH) {
    return extractClaimsFromText(fullText, {
      maxClaims: 15,
      sourceTitle,
    });
  }

  // For long texts, split into sections and process
  const sections = splitIntoSections(fullText);
  const allClaims: ExtractedClaim[] = [];
  let totalTime = 0;
  let totalTokens = 0;

  for (const section of sections) {
    // Skip very short sections
    if (section.text.length < 200) continue;
    
    try {
      const result = await extractClaimsFromText(section.text, {
        maxClaims: 5,
        sourceTitle,
      });
      
      // Add section info to claims that don't have it
      result.claims.forEach((claim) => {
        if (!claim.sectionName) {
          claim.sectionName = section.name;
        }
      });
      
      allClaims.push(...result.claims);
      totalTime += result.processingTime;
      totalTokens += result.tokensUsed;
    } catch (error) {
      console.error(`Failed to extract claims from section: ${section.name}`, error);
      // Continue with other sections
    }
  }

  // Deduplicate and rank claims
  const deduped = deduplicateClaims(allClaims);
  const ranked = deduped.sort((a, b) => b.confidence - a.confidence);

  return {
    claims: ranked.slice(0, 15), // Return top 15 claims
    processingTime: totalTime,
    tokensUsed: totalTokens,
  };
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

/**
 * Validate and normalize claim type from AI response
 */
function validateClaimType(input: string): AcademicClaimType {
  const normalized = input?.toUpperCase().trim();
  
  // Check if it's a valid enum value
  if (Object.values(AcademicClaimType).includes(normalized as AcademicClaimType)) {
    return normalized as AcademicClaimType;
  }
  
  // Map common variations
  const mappings: Record<string, AcademicClaimType> = {
    "THEORETICAL": AcademicClaimType.CONCEPTUAL,
    "EVALUATIVE": AcademicClaimType.NORMATIVE,
    "PRESCRIPTIVE": AcademicClaimType.NORMATIVE,
    "DESCRIPTIVE": AcademicClaimType.EMPIRICAL,
    "MAIN": AcademicClaimType.THESIS,
    "CENTRAL": AcademicClaimType.THESIS,
    "DATA-BASED": AcademicClaimType.EMPIRICAL,
    "EXPERIMENTAL": AcademicClaimType.EMPIRICAL,
  };
  
  if (mappings[normalized]) {
    return mappings[normalized];
  }
  
  // Default fallback
  return AcademicClaimType.THESIS;
}

/**
 * Split document text into logical sections
 */
function splitIntoSections(text: string): Array<{ name: string; text: string }> {
  // Common section headers in academic papers
  const sectionPatterns = [
    { pattern: /^#+\s*(abstract|summary)/im, name: "Abstract" },
    { pattern: /^#+\s*(introduction|background)/im, name: "Introduction" },
    { pattern: /^#+\s*(literature\s+review|related\s+work|prior\s+work)/im, name: "Literature Review" },
    { pattern: /^#+\s*(method|methodology|approach|materials?\s+and\s+methods?)/im, name: "Methods" },
    { pattern: /^#+\s*(results?|findings?)/im, name: "Results" },
    { pattern: /^#+\s*(discussion)/im, name: "Discussion" },
    { pattern: /^#+\s*(conclusions?|concluding\s+remarks?)/im, name: "Conclusion" },
  ];

  const sections: Array<{ name: string; text: string }> = [];
  let currentSection = { name: "Introduction", text: "" };

  const lines = text.split("\n");
  
  for (const line of lines) {
    let foundSection = false;
    
    for (const { pattern, name } of sectionPatterns) {
      if (pattern.test(line.trim())) {
        // Save previous section if it has content
        if (currentSection.text.trim().length > 100) {
          sections.push({ ...currentSection });
        }
        // Start new section
        currentSection = { name, text: "" };
        foundSection = true;
        break;
      }
    }
    
    if (!foundSection) {
      currentSection.text += line + "\n";
    }
  }

  // Add final section
  if (currentSection.text.trim().length > 100) {
    sections.push(currentSection);
  }

  // If no sections found, return the whole text as one section
  if (sections.length === 0) {
    return [{ name: "Document", text: text.slice(0, 15000) }];
  }

  return sections;
}

/**
 * Deduplicate claims based on text similarity
 */
function deduplicateClaims(claims: ExtractedClaim[]): ExtractedClaim[] {
  const seen = new Set<string>();
  const result: ExtractedClaim[] = [];

  for (const claim of claims) {
    // Normalize text for comparison
    const normalized = claim.text
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s]/g, "")
      .trim();
    
    // Use first 80 chars as key for fuzzy matching
    const key = normalized.slice(0, 80);
    
    if (!seen.has(key)) {
      seen.add(key);
      result.push(claim);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────
// Batch Operations
// ─────────────────────────────────────────────────────────

/**
 * Extract claims from multiple sources in batch
 * 
 * @param sources - Array of {id, abstract, title} objects
 * @returns Map of source ID to extraction results
 */
export async function batchExtractClaims(
  sources: Array<{ id: string; abstract: string; title: string }>
): Promise<Map<string, ExtractionResult>> {
  const results = new Map<string, ExtractionResult>();
  
  // Process sequentially to avoid rate limits
  for (const source of sources) {
    try {
      const result = await extractClaimsFromAbstract(source.abstract, source.title);
      results.set(source.id, result);
      
      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to extract claims for source ${source.id}:`, error);
      results.set(source.id, {
        claims: [],
        processingTime: 0,
        tokensUsed: 0,
      });
    }
  }
  
  return results;
}
