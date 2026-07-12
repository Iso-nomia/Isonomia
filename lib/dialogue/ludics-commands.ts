// lib/dialogue/ludics-commands.ts
// Ludics-specific CommandCardActions for integration with command palette
// Provides actions for: compile, step, commit, orthogonality check, trace inspection

import type { CommandCardAction, TargetRef } from "@/components/dialogue/command-card/types";

/**
 * Generate Ludics command actions for a given deliberation/claim target.
 * These commands integrate Ludics dialogical logic operations into the command palette.
 * 
 * @param target - Target reference (deliberation context)
 * @param options - Optional configuration
 * @returns Array of CommandCardActions for Ludics operations
 */
export function getLudicsCommands(
  target: TargetRef,
  options?: {
    hasDesigns?: boolean;
    canStep?: boolean;
    orthogonalityStatus?: string | null;
  }
): CommandCardAction[] {
  const { hasDesigns = false, canStep = false, orthogonalityStatus = null } = options || {};

  const commands: CommandCardAction[] = [
    // 1. Compile Designs (⚙️)
    {
      id: "ludics-compile",
      kind: "WHY", // Reuse protocol kind (represents questioning/analysis)
      label: "⚙️ Compile Ludics Designs",
      force: "NEUTRAL",
      disabled: false,
      relevance: hasDesigns ? "unlikely" : "likely",
      move: {
        kind: "WHY",
        payload: {
          action: "compile",
          ludics: true,
        },
      },
      target,
      group: "top",
      tone: "primary",
    },

    // 2. Step Interaction (⚡)
    {
      id: "ludics-step",
      kind: "WHY",
      label: "⚡ Step Ludics Interaction",
      force: "ATTACK",
      disabled: !canStep,
      reason: canStep ? undefined : "Compile designs first",
      relevance: canStep ? "likely" : null,
      move: {
        kind: "WHY",
        payload: {
          action: "step",
          ludics: true,
        },
      },
      target,
      group: "top",
      tone: "default",
    },

    // 3. Add Commitment (⚓)
    {
      id: "ludics-commit",
      kind: "GROUNDS",
      label: "⚓ Add Commitment",
      force: "NEUTRAL",
      disabled: !hasDesigns,
      reason: hasDesigns ? undefined : "No designs to commit to",
      relevance: hasDesigns ? "likely" : null,
      move: {
        kind: "GROUNDS",
        payload: {
          action: "commit",
          ludics: true,
          expression: "", // User will provide via composer
        },
      },
      target,
      group: "mid",
      tone: "default",
    },

    // 4. Check Orthogonality (⊥)
    {
      id: "ludics-orthogonality",
      kind: "WHY",
      label: orthogonalityStatus === "orthogonal" 
        ? "✓ Orthogonal" 
        : orthogonalityStatus === "non-orthogonal"
        ? "✗ Non-Orthogonal"
        : "⊥ Check Orthogonality",
      force: "NEUTRAL",
      disabled: !canStep,
      reason: canStep ? undefined : "Step interaction first",
      relevance: canStep && !orthogonalityStatus ? "likely" : null,
      move: {
        kind: "WHY",
        payload: {
          action: "orthogonality",
          ludics: true,
        },
      },
      target,
      group: "mid",
      tone: orthogonalityStatus === "non-orthogonal" ? "danger" : "default",
    },

    // 5. Inspect Trace (🔍)
    {
      id: "ludics-trace",
      kind: "WHY",
      label: "🔍 Inspect Trace",
      force: "NEUTRAL",
      disabled: !hasDesigns,
      reason: hasDesigns ? undefined : "No trace available",
      relevance: hasDesigns ? "likely" : null,
      move: {
        kind: "WHY",
        payload: {
          action: "trace",
          ludics: true,
        },
      },
      target,
      group: "bottom",
      tone: "default",
    },
  ];

  return commands;
}

/**
 * Convenience function to get Ludics commands for a specific deliberation.
 * Fetches current state to determine which commands are available.
 * 
 * @param deliberationId - Deliberation ID
 * @returns Promise resolving to CommandCardAction array
 */
export async function getLudicsCommandsForDeliberation(
  deliberationId: string
): Promise<CommandCardAction[]> {
  try {
    // Fetch insights to determine state
    const response = await fetch(`/api/ludics/insights?deliberationId=${deliberationId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch insights");
    }

    const insights = await response.json();

    const target: TargetRef = {
      deliberationId,
      targetType: "claim",
      targetId: "ludics-panel", // Virtual target for panel-level commands
    };

    return getLudicsCommands(target, {
      hasDesigns: (insights?.totalActs ?? 0) > 0,
      canStep: (insights?.totalActs ?? 0) > 0 && insights?.orthogonalityStatus !== "convergent",
      orthogonalityStatus: insights?.orthogonalityStatus ?? null,
    });
  } catch (error) {
    console.error("[ludics-commands] Error fetching state:", error);
    
    // Return basic commands if API fails
    const target: TargetRef = {
      deliberationId,
      targetType: "claim",
      targetId: "ludics-panel",
    };
    
    return getLudicsCommands(target, {
      hasDesigns: false,
      canStep: false,
      orthogonalityStatus: null,
    });
  }
}

/**
 * Execute a Ludics command action.
 * This handler processes the command payload and triggers the appropriate backend operation.
 * 
 * @param action - CommandCardAction to execute
 * @returns Promise resolving when command completes
 */
export async function executeLudicsCommand(
  action: CommandCardAction
): Promise<void> {
  if (!action.move?.payload?.ludics) {
    throw new Error("Not a Ludics command");
  }

  const { deliberationId } = action.target;
  const actionType = action.move.payload.action;

  switch (actionType) {
    case "compile":
      // Trigger compile via API
      await fetch(`/api/ludics/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliberationId }),
      });
      break;

    case "step":
      // Trigger step via API (requires design IDs - fetch from insights)
      const insightsRes = await fetch(`/api/ludics/insights?deliberationId=${deliberationId}`);
      const insights = await insightsRes.json();
      
      if (!insights?.designs || insights.designs.length < 2) {
        throw new Error("Need at least 2 designs to step");
      }

      await fetch(`/api/ludics/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          posDesignId: insights.designs[0],
          negDesignId: insights.designs[1],
          phase: "neutral",
        }),
      });
      break;

    case "commit":
      // Open composer with commitment template
      console.log("[ludics-commands] Opening commitment composer");
      // TODO: Integrate with composer UI
      break;

    case "orthogonality":
      // Fetch orthogonality check
      await fetch(`/api/ludics/orthogonality?deliberationId=${deliberationId}`);
      break;

    case "trace":
      // Open trace viewer (handled by UI)
      console.log("[ludics-commands] Opening trace viewer");
      // TODO: Trigger TraceViewer modal/panel
      break;

    default:
      throw new Error(`Unknown Ludics action: ${actionType}`);
  }
}
