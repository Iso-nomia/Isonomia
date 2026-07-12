"use client";

/**
 * DDS Phase 3 - Position Detail Panel
 * 
 * Shows detailed information about a legal position including views.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

type ArenaMove = {
  id: string;
  address: string;
  ramification: number[];
  player: "P" | "O";
  isInitial: boolean;
};

type UniversalArena = {
  id: string;
  moves: ArenaMove[];
};

type LegalPosition = {
  id: string;
  arenaId: string;
  sequence: ArenaMove[];
  currentPlayer: "P" | "O";
  isTerminal: boolean;
  pView?: ArenaMove[];
  oView?: ArenaMove[];
};

interface PositionDetailPanelProps {
  position: LegalPosition;
  arena: UniversalArena;
  className?: string;
}

export function PositionDetailPanel({
  position,
  arena,
  className,
}: PositionDetailPanelProps) {
  const [computedViews, setComputedViews] = React.useState<{
    pView: ArenaMove[];
    oView: ArenaMove[];
  } | null>(null);
  const [isComputing, setIsComputing] = React.useState(false);

  // Compute views client-side (simplified algorithm)
  const computeViews = React.useCallback(() => {
    const sequence = position.sequence;
    if (sequence.length === 0) {
      setComputedViews({ pView: [], oView: [] });
      return;
    }

    // Simplified P-view: all P moves and their justifiers
    const pView: ArenaMove[] = [];
    const oView: ArenaMove[] = [];

    for (const move of sequence) {
      if (move.player === "P") {
        pView.push(move);
      } else {
        oView.push(move);
      }
    }

    // For full implementation, would need proper view computation from Definition 3.5
    setComputedViews({ pView, oView });
  }, [position.sequence]);

  React.useEffect(() => {
    computeViews();
  }, [computeViews]);

  // Compute validity
  const validity = React.useMemo(() => {
    const errors: string[] = [];
    const sequence = position.sequence;

    // 1. Parity check
    let parityOk = true;
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i].player === sequence[i - 1].player) {
        parityOk = false;
        errors.push(`Parity violation at move ${i + 1}`);
      }
    }

    // 2. Linearity check
    let linearityOk = true;
    const addresses = new Set<string>();
    for (const move of sequence) {
      if (addresses.has(move.address)) {
        linearityOk = false;
        errors.push(`Address ${move.address} repeated`);
      }
      addresses.add(move.address);
    }

    // 3. Justification (simplified)
    const justificationOk = true; // Would need full check

    // 4. Visibility (simplified)
    const visibilityOk = true; // Would need full check

    return {
      isValid: parityOk && linearityOk && justificationOk && visibilityOk,
      parityOk,
      linearityOk,
      justificationOk,
      visibilityOk,
      errors,
    };
  }, [position.sequence]);

  return (
    <div className={cn("bg-white border rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="bg-slate-50 border-b px-4 py-3 flex items-center justify-between">
        <h4 className="font-semibold">Position Details</h4>
        <div className="flex items-center gap-2">
          {validity.isValid ? (
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
              ✓ Valid
            </span>
          ) : (
            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
              ✗ Invalid
            </span>
          )}
          <span
            className={cn(
              "text-xs px-2 py-1 rounded",
              position.currentPlayer === "P"
                ? "bg-blue-100 text-blue-700"
                : "bg-rose-100 text-rose-700"
            )}
          >
            {position.currentPlayer}'s turn
          </span>
          {position.isTerminal && (
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">
              Terminal
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Sequence */}
        <div>
          <h5 className="text-sm font-medium text-slate-600 mb-2">
            Sequence (length: {position.sequence.length})
          </h5>
          <div className="bg-slate-50 rounded-lg p-3">
            {position.sequence.length === 0 ? (
              <span className="text-slate-400 italic text-sm">Empty position</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {position.sequence.map((move, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded text-sm",
                      move.player === "P"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-rose-100 text-rose-700"
                    )}
                  >
                    <span className="opacity-60 text-xs">{idx + 1}.</span>
                    <span className="font-mono">{move.address}</span>
                    {move.ramification.length > 0 && (
                      <span className="text-xs opacity-60">
                        [{move.ramification.join(",")}]
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Views */}
        <div className="grid grid-cols-2 gap-4">
          {/* P-View */}
          <div>
            <h5 className="text-sm font-medium text-blue-600 mb-2">P-View (Proponent)</h5>
            <div className="bg-blue-50 rounded-lg p-3 min-h-[60px]">
              {computedViews?.pView.length === 0 ? (
                <span className="text-blue-400 italic text-sm">Empty</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {computedViews?.pView.map((move, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-mono"
                    >
                      {move.address}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* O-View */}
          <div>
            <h5 className="text-sm font-medium text-rose-600 mb-2">O-View (Opponent)</h5>
            <div className="bg-rose-50 rounded-lg p-3 min-h-[60px]">
              {computedViews?.oView.length === 0 ? (
                <span className="text-rose-400 italic text-sm">Empty</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {computedViews?.oView.map((move, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-sm font-mono"
                    >
                      {move.address}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Validity Checks */}
        <div>
          <h5 className="text-sm font-medium text-slate-600 mb-2">Validity Checks</h5>
          <div className="grid grid-cols-4 gap-2">
            <ValidityBadge label="Parity" ok={validity.parityOk} />
            <ValidityBadge label="Linearity" ok={validity.linearityOk} />
            <ValidityBadge label="Justification" ok={validity.justificationOk} />
            <ValidityBadge label="Visibility" ok={validity.visibilityOk} />
          </div>
          {validity.errors.length > 0 && (
            <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-600">
              {validity.errors.map((err, idx) => (
                <div key={idx}>• {err}</div>
              ))}
            </div>
          )}
        </div>

        {/* Address Graph (simplified) */}
        <div>
          <h5 className="text-sm font-medium text-slate-600 mb-2">Address Structure</h5>
          <div className="bg-slate-50 rounded-lg p-3 font-mono text-sm">
            <AddressTree moves={position.sequence} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ValidityBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={cn(
        "px-2 py-1 rounded text-xs text-center",
        ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      )}
    >
      {ok ? "✓" : "✗"} {label}
    </div>
  );
}

function AddressTree({ moves }: { moves: ArenaMove[] }) {
  if (moves.length === 0) {
    return <span className="text-slate-400">⊢ (root)</span>;
  }

  // Build simple address hierarchy display
  const sortedMoves = [...moves].sort((a, b) => a.address.localeCompare(b.address));

  return (
    <div className="space-y-0.5">
      <div className="text-slate-400">⊢ root</div>
      {sortedMoves.map((move, idx) => {
        const depth = move.address.split(".").length;
        const indent = "  ".repeat(depth);
        return (
          <div key={idx} className="flex items-center gap-1">
            <span className="text-slate-300">{indent}├─</span>
            <span
              className={cn(
                move.player === "P" ? "text-blue-600" : "text-rose-600"
              )}
            >
              {move.address}
            </span>
            {move.ramification.length > 0 && (
              <span className="text-slate-400 text-xs">
                [{move.ramification.join(",")}]
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PositionDetailPanel;
